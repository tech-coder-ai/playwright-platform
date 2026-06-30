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

@WebSocketGateway({
  namespace: 'codegen',
  cors: { origin: 'http://localhost:4200' },
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
  }

  @SubscribeMessage('start')
  async handleStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      projectId: string;
      url: string;
      mode?: 'test' | 'page-object';
      targetPageObjectId?: string;
    },
  ) {
    try {
      const session = await this.codegenService.start(body.projectId, body.url, {
        mode: body.mode,
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
