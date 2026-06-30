import { Injectable, NgZone, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { CodegenSessionMeta } from '@playwright-platform/shared-types';

@Injectable({ providedIn: 'root' })
export class CodegenSocketService {
  private readonly zone = inject(NgZone);
  private socket: Socket | null = null;

  readonly session = signal<CodegenSessionMeta | null>(null);
  readonly output = signal('');
  readonly connected = signal(false);
  readonly error = signal<string | null>(null);

  connect() {
    if (this.socket?.connected) return;

    this.socket = io('/codegen', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      this.zone.run(() => this.connected.set(true));
    });

    this.socket.on('disconnect', () => {
      this.zone.run(() => this.connected.set(false));
    });

    this.socket.on('started', (session: CodegenSessionMeta) => {
      this.zone.run(() => {
        this.session.set(session);
        this.output.set(session.content ?? '');
        this.error.set(null);
      });
    });

    this.socket.on('output', (payload: { sessionId: string; content: string }) => {
      this.zone.run(() => this.output.set(payload.content));
    });

    this.socket.on('status', (payload: { sessionId: string; status: string; errorMessage?: string }) => {
      this.zone.run(() => {
        const current = this.session();
        if (current && current.id === payload.sessionId) {
          this.session.set({
            ...current,
            status: payload.status as CodegenSessionMeta['status'],
            errorMessage: payload.errorMessage,
          });
        }
        if (payload.errorMessage) {
          this.error.set(payload.errorMessage);
        }
      });
    });

    this.socket.on('stopped', (session: CodegenSessionMeta) => {
      this.zone.run(() => {
        this.session.set(session);
        this.output.set(session.content ?? this.output());
      });
    });

    this.socket.on('error', (payload: { message: string }) => {
      this.zone.run(() => this.error.set(payload.message));
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }

  start(
    projectId: string,
    url: string,
    options: { mode?: 'test' | 'page-object'; targetPageObjectId?: string } = {},
  ) {
    this.connect();
    this.error.set(null);
    this.output.set('');
    this.session.set(null);
    this.socket?.emit('start', { projectId, url, ...options });
  }

  stop(sessionId: string) {
    this.socket?.emit('stop', { sessionId });
  }

  reset() {
    this.output.set('');
    this.session.set(null);
    this.error.set(null);
  }
}
