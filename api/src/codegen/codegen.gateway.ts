import { Logger, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { CodegenService } from './codegen.service';
import type { RemoteInputEvent } from '@playwright-platform/shared-types';

function corsOrigins(): string[] {
  return (process.env['CORS_ORIGINS'] ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

@WebSocketGateway({
  namespace: 'codegen',
  // Screencast frames are ~30-80KB base64 JPEGs.
  maxHttpBufferSize: 5e6,
  cors: { origin: corsOrigins() },
})
export class CodegenGateway implements OnModuleInit {
  private readonly logger = new Logger(CodegenGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly codegenService: CodegenService) {}

  onModuleInit() {
    this.codegenService.setOutputHandler((sessionId, content) => {
      this.server.to(sessionId).emit('output', { sessionId, content });
    });
    this.codegenService.setStatusHandler((sessionId, status, errorMessage) => {
      this.server.to(sessionId).emit('status', { sessionId, status, errorMessage });
    });
    this.codegenService.setFrameHandler((frame) => {
      // volatile: dropping a stale video frame beats queueing it.
      this.server.to(frame.sessionId).volatile.emit('frame', frame);
    });
  }

  @SubscribeMessage('start')
  async handleStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      projectId: string;
      url: string;
      mode?: 'test' | 'page-object';
      recorder?: 'local' | 'remote';
      targetPageObjectId?: string;
    },
  ) {
    try {
      const session = await this.codegenService.start(body.projectId, body.url, {
        mode: body.mode,
        recorder: body.recorder,
        targetPageObjectId: body.targetPageObjectId,
      });
      await client.join(session.id);
      client.emit('started', session);
      if (session.content) {
        client.emit('output', { sessionId: session.id, content: session.content });
      }
      return session;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start recording';
      this.logger.error(message);
      client.emit('error', { message });
      return { error: message };
    }
  }

  @SubscribeMessage('stop')
  async handleStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string },
  ) {
    try {
      const session = await this.codegenService.stop(body.sessionId);
      client.emit('stopped', session);
      return session;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop recording';
      client.emit('error', { message });
      return { error: message };
    }
  }

  @SubscribeMessage('input')
  async handleInput(
    @MessageBody() body: { sessionId: string; event: RemoteInputEvent },
  ) {
    try {
      await this.codegenService.dispatchInput(body.sessionId, body.event);
    } catch {
      // Session ended between frames — nothing actionable for the client.
    }
  }

  @SubscribeMessage('resize')
  async handleResize(
    @MessageBody() body: { sessionId: string; width: number; height: number },
  ) {
    try {
      await this.codegenService.resize(body.sessionId, body.width, body.height);
    } catch {
      // Session ended — ignore.
    }
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string },
  ) {
    try {
      const session = this.codegenService.getSession(body.sessionId);
      await client.join(session.id);
      client.emit('joined', session);
      if (session.content) {
        client.emit('output', { sessionId: session.id, content: session.content });
      }
      return session;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Session not found';
      client.emit('error', { message });
      return { error: message };
    }
  }
}
