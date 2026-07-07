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
import {
  getCodegenOutputPath,
  getCodegenRelativeOutputPath,
  getCodegenSessionDir,
} from './codegen.paths';
import type { CodegenSessionMeta, CodegenSessionMode, CodegenSessionStatus } from '@playwright-platform/shared-types';

type SessionRecord = {
  id: string;
  projectId: string;
  url: string;
  mode: CodegenSessionMode;
  targetPageObjectId?: string;
  status: CodegenSessionStatus;
  outputPath: string;
  outputRelativePath: string;
  content: string;
  errorMessage?: string;
  startedAt: Date;
  endedAt?: Date;
  process?: ChildProcess;
  watchTimer?: ReturnType<typeof setInterval>;
};

@Injectable()
export class CodegenService implements OnModuleDestroy {
  private readonly logger = new Logger(CodegenService.name);
  private readonly sessions = new Map<string, SessionRecord>();
  private outputHandler?: (sessionId: string, content: string) => void;
  private statusHandler?: (sessionId: string, status: CodegenSessionStatus, errorMessage?: string) => void;

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

  async start(
    projectId: string,
    url: string,
    options: { mode?: CodegenSessionMode; targetPageObjectId?: string } = {},
  ): Promise<CodegenSessionMeta> {
    await ensureProjectExists(this.db, projectId);
    const normalizedUrl = this.normalizeUrl(url);
    const mode = options.mode ?? 'test';

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
      targetPageObjectId: options.targetPageObjectId,
      status: 'starting',
      outputPath,
      outputRelativePath: getCodegenRelativeOutputPath(sessionId, mode),
      content: '',
      startedAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.emitStatus(sessionId, 'starting');

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

  async stop(sessionId: string): Promise<CodegenSessionMeta> {
    const session = this.getSessionOrThrow(sessionId);
    if (session.status === 'recording' || session.status === 'starting') {
      session.process?.kill('SIGINT');
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
    session.process?.kill('SIGTERM');
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
