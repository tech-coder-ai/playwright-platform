import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { ensureProjectExists } from '../common/ensure-exists.util';
import { getTestsRoot } from '../test-runner/paths.util';
import { buildPlaywrightBrowserEnv } from '../common/browser-env.util';
import { resolvePlaywrightCli } from '../common/cli-path.util';
import { killProcessTree } from '../common/kill-process-tree.util';
import {
  getCodegenOutputPath,
  getCodegenRelativeOutputPath,
  getCodegenSessionDir,
} from './codegen.paths';
import { RemoteRecorderSession } from './remote-recorder';
import type {
  CodegenRecorderMode,
  CodegenSessionMeta,
  CodegenSessionMode,
  CodegenSessionStatus,
  RemoteInputEvent,
  ScreencastFramePayload,
} from '@playwright-platform/shared-types';

const DEFAULT_REMOTE_VIEWPORT = { width: 1280, height: 720 };

type SessionRecord = {
  id: string;
  projectId: string;
  url: string;
  mode: CodegenSessionMode;
  recorder: CodegenRecorderMode;
  targetPageObjectId?: string;
  status: CodegenSessionStatus;
  outputPath: string;
  outputRelativePath: string;
  content: string;
  errorMessage?: string;
  startedAt: Date;
  endedAt?: Date;
  process?: ChildProcess;
  remote?: RemoteRecorderSession;
  watchTimer?: ReturnType<typeof setInterval>;
};

@Injectable()
export class CodegenService implements OnModuleDestroy {
  private readonly logger = new Logger(CodegenService.name);
  private readonly sessions = new Map<string, SessionRecord>();
  private outputHandler?: (sessionId: string, content: string) => void;
  private statusHandler?: (sessionId: string, status: CodegenSessionStatus, errorMessage?: string) => void;
  private frameHandler?: (frame: ScreencastFramePayload) => void;

  constructor(private readonly db: DatabaseService) {}

  onModuleDestroy() {
    for (const session of this.sessions.values()) {
      this.cleanupSession(session, 'stopped');
    }
  }

  setOutputHandler(handler: (sessionId: string, content: string) => void) {
    this.outputHandler = handler;
  }

  setStatusHandler(
    handler: (sessionId: string, status: CodegenSessionStatus, errorMessage?: string) => void,
  ) {
    this.statusHandler = handler;
  }

  setFrameHandler(handler: (frame: ScreencastFramePayload) => void) {
    this.frameHandler = handler;
  }

  /**
   * Recorder mode resolution: the deployment sets the default via
   * CODEGEN_RECORDER (local | remote); a client may override per session
   * unless CODEGEN_RECORDER_LOCKED=true pins the server default.
   */
  private resolveRecorderMode(requested?: CodegenRecorderMode): CodegenRecorderMode {
    const configured: CodegenRecorderMode =
      process.env['CODEGEN_RECORDER'] === 'remote' ? 'remote' : 'local';
    if (process.env['CODEGEN_RECORDER_LOCKED'] === 'true') return configured;
    return requested ?? configured;
  }

  async start(
    projectId: string,
    url: string,
    options: {
      mode?: CodegenSessionMode;
      recorder?: CodegenRecorderMode;
      targetPageObjectId?: string;
    } = {},
  ): Promise<CodegenSessionMeta> {
    await ensureProjectExists(this.db, projectId);
    const normalizedUrl = this.normalizeUrl(url);
    const mode = options.mode ?? 'test';
    const recorder = this.resolveRecorderMode(options.recorder);

    if (options.targetPageObjectId) {
      const existing = await this.db.pageObject.findFirst({
        where: { id: options.targetPageObjectId, projectId },
      });
      if (!existing) {
        throw new BadRequestException('Target page object not found in this project');
      }
    }

    const sessionId = randomUUID();
    const sessionDir = getCodegenSessionDir(sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
    const outputPath = getCodegenOutputPath(sessionId, mode);
    await fs.writeFile(outputPath, '', 'utf8');

    const session: SessionRecord = {
      id: sessionId,
      projectId,
      url: normalizedUrl,
      mode,
      recorder,
      targetPageObjectId: options.targetPageObjectId,
      status: 'starting',
      outputPath,
      outputRelativePath: getCodegenRelativeOutputPath(sessionId, mode),
      content: '',
      startedAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.emitStatus(sessionId, 'starting');

    if (recorder === 'remote') {
      return this.startRemote(session);
    }

    try {
      const child = spawn(
        process.execPath,
        [
          resolvePlaywrightCli(getTestsRoot()),
          'codegen',
          normalizedUrl,
          `--output=${outputPath}`,
          '--target=playwright-test',
          '--browser=chromium',
        ],
        {
          cwd: getTestsRoot(),
          env: { ...process.env, ...buildPlaywrightBrowserEnv() },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      session.process = child;
      session.status = 'recording';
      this.emitStatus(sessionId, 'recording');

      child.stdout?.on('data', (chunk: Buffer) => {
        this.logger.debug(`codegen stdout [${sessionId}]: ${chunk.toString()}`);
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        this.logger.debug(`codegen stderr [${sessionId}]: ${chunk.toString()}`);
      });

      child.on('error', (error) => {
        session.status = 'error';
        session.errorMessage = error.message;
        this.emitStatus(sessionId, 'error', error.message);
        this.stopWatching(session);
      });

      child.on('close', (code) => {
        if (session.status === 'recording') {
          session.status = code === 0 ? 'stopped' : 'error';
          if (code !== 0 && !session.errorMessage) {
            session.errorMessage = `Codegen exited with code ${code ?? 'unknown'}`;
          }
          session.endedAt = new Date();
          this.emitStatus(sessionId, session.status, session.errorMessage);
        }
        this.stopWatching(session);
        void this.readOutputFile(session);
      });

      session.watchTimer = setInterval(() => {
        void this.readOutputFile(session);
      }, 500);
    } catch (error) {
      session.status = 'error';
      session.errorMessage = error instanceof Error ? error.message : 'Failed to start codegen';
      session.endedAt = new Date();
      this.emitStatus(sessionId, 'error', session.errorMessage);
      throw new BadRequestException(session.errorMessage);
    }

    return this.toMeta(session);
  }

  /** Headless server-side browser streamed to the web UI (see RemoteRecorderSession). */
  private async startRemote(session: SessionRecord): Promise<CodegenSessionMeta> {
    const remote = new RemoteRecorderSession({
      url: session.url,
      outputFile: session.outputPath,
      viewport: { ...DEFAULT_REMOTE_VIEWPORT },
      onFrame: (frame) => {
        this.frameHandler?.({ sessionId: session.id, ...frame });
      },
      onError: (message) => {
        this.logger.warn(`remote recorder [${session.id}]: ${message}`);
        session.errorMessage = message;
        this.emitStatus(session.id, session.status, message);
      },
    });

    try {
      await remote.start();
      session.remote = remote;
      session.status = 'recording';
      this.emitStatus(session.id, 'recording');
      session.watchTimer = setInterval(() => {
        void this.readOutputFile(session);
      }, 500);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to start remote recording browser';
      session.status = 'error';
      session.errorMessage = message;
      session.endedAt = new Date();
      this.emitStatus(session.id, 'error', message);
      throw new BadRequestException(message);
    }

    return this.toMeta(session);
  }

  async dispatchInput(sessionId: string, event: RemoteInputEvent): Promise<void> {
    const session = this.getSessionOrThrow(sessionId);
    if (session.status !== 'recording' || !session.remote) return;
    await session.remote.dispatchInput(event);
  }

  async resize(sessionId: string, width: number, height: number): Promise<void> {
    const session = this.getSessionOrThrow(sessionId);
    if (session.status !== 'recording' || !session.remote) return;
    await session.remote.resize(width, height);
  }

  async stop(sessionId: string): Promise<CodegenSessionMeta> {
    const session = this.getSessionOrThrow(sessionId);
    if (session.status === 'recording' || session.status === 'starting') {
      killProcessTree(session.process, 'SIGINT');
      if (session.remote) {
        // Closing the context flushes the recorder's output file.
        await session.remote.close();
        session.remote = undefined;
      }
      session.status = 'stopped';
      session.endedAt = new Date();
      this.stopWatching(session);
      await this.readOutputFile(session);
      this.emitStatus(sessionId, 'stopped');
    }
    return this.toMeta(session);
  }

  getSession(sessionId: string): CodegenSessionMeta {
    return this.toMeta(this.getSessionOrThrow(sessionId));
  }

  listByProject(projectId: string): CodegenSessionMeta[] {
    return [...this.sessions.values()]
      .filter((session) => session.projectId === projectId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .map((session) => this.toMeta(session));
  }

  private getSessionOrThrow(sessionId: string): SessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException(`Codegen session ${sessionId} not found`);
    }
    return session;
  }

  private async readOutputFile(session: SessionRecord) {
    try {
      const content = await fs.readFile(session.outputPath, 'utf8');
      if (content !== session.content) {
        session.content = content;
        this.outputHandler?.(session.id, content);
      }
    } catch {
      // File may not exist yet while codegen is starting.
    }
  }

  private stopWatching(session: SessionRecord) {
    if (session.watchTimer) {
      clearInterval(session.watchTimer);
      session.watchTimer = undefined;
    }
  }

  private cleanupSession(session: SessionRecord, status: CodegenSessionStatus) {
    this.stopWatching(session);
    killProcessTree(session.process, 'SIGTERM');
    if (session.remote) {
      void session.remote.close();
      session.remote = undefined;
    }
    session.status = status;
    session.endedAt = new Date();
  }

  private emitStatus(sessionId: string, status: CodegenSessionStatus, errorMessage?: string) {
    this.statusHandler?.(sessionId, status, errorMessage);
  }

  private normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) {
      throw new BadRequestException('URL is required');
    }
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      return new URL(withProtocol).toString();
    } catch {
      throw new BadRequestException('Invalid URL');
    }
  }

  private toMeta(session: SessionRecord): CodegenSessionMeta {
    return {
      id: session.id,
      projectId: session.projectId,
      url: session.url,
      mode: session.mode,
      recorder: session.recorder,
      viewport: session.remote?.getViewport(),
      targetPageObjectId: session.targetPageObjectId,
      status: session.status,
      outputRelativePath: session.outputRelativePath,
      content: session.content,
      errorMessage: session.errorMessage,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString(),
    };
  }
}
