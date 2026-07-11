import {
  Component,
  ElementRef,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import type { RemoteInputEvent } from '@playwright-platform/shared-types';
import { CodegenSocketService } from '../../core/services/codegen-socket.service';

/**
 * Live view of the server-side recording browser: renders CDP screencast
 * frames onto a canvas and forwards mouse/keyboard input back to the server,
 * where Playwright's recorder captures it as real user interaction.
 */
@Component({
  selector: 'app-remote-viewport',
  template: `
    <div
      #stage
      class="stage"
      tabindex="0"
      role="application"
      aria-label="Remote browser — interactions are recorded"
      (mousedown)="onMouse($event, 'mousedown')"
      (mouseup)="onMouse($event, 'mouseup')"
      (mousemove)="onMouse($event, 'mousemove')"
      (wheel)="onWheel($event)"
      (keydown)="onKey($event, 'keydown')"
      (keyup)="onKey($event, 'keyup')"
      (contextmenu)="$event.preventDefault()"
    >
      <canvas #canvas></canvas>
      @if (!hasFrame) {
        <div class="placeholder">
          <span class="spinner"></span>
          <p>Launching browser on the server…</p>
          <p class="sub">First loads of enterprise apps can take a few minutes. Frames appear as soon as the page starts rendering.</p>
        </div>
      }
    </div>
    <p class="viewport-hint">
      You are interacting with a browser running on the server — every click and keystroke is recorded.
      Click the view first to give it keyboard focus.
    </p>
  `,
  styles: `
    :host {
      display: block;
    }

    .stage {
      position: relative;
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      background: var(--surface-sunken);
      cursor: crosshair;
      min-height: 20rem;
      outline: none;

      &:focus-visible {
        border-color: var(--accent);
        box-shadow: var(--focus-ring);
      }
    }

    canvas {
      display: block;
      width: 100%;
      height: auto;
    }

    .placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: var(--border-strong);
      font-size: 0.875rem;
      text-align: center;
      padding: 1rem;

      .sub {
        color: var(--text-muted);
        font-size: 0.75rem;
        max-width: 28rem;
        margin: 0;
      }

      p {
        margin: 0;
      }
    }

    .spinner {
      width: 1.75rem;
      height: 1.75rem;
      border: 3px solid rgb(148 163 184 / 30%);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .viewport-hint {
      margin: 0.5rem 0 0;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
  `,
})
export class RemoteViewportComponent {
  readonly sessionId = input.required<string>();

  private readonly codegen = inject(CodegenSocketService);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  hasFrame = false;
  private remoteWidth = 1280;
  private remoteHeight = 720;
  private lastMove = 0;

  constructor() {
    effect(() => {
      const frame = this.codegen.frame();
      if (!frame || frame.sessionId !== this.sessionId()) return;
      this.remoteWidth = frame.width;
      this.remoteHeight = frame.height;
      this.drawFrame(frame.data, frame.width, frame.height);
    });
  }

  private drawFrame(base64: string, width: number, height: number) {
    const canvas = this.canvasRef().nativeElement;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const image = new Image();
    image.onload = () => {
      canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
      this.hasFrame = true;
    };
    image.src = `data:image/jpeg;base64,${base64}`;
  }

  /** Translates canvas CSS coordinates into remote-viewport pixels. */
  private toRemote(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    const scaleX = this.remoteWidth / rect.width;
    const scaleY = this.remoteHeight / rect.height;
    return {
      x: Math.max(0, Math.min(this.remoteWidth, (event.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(this.remoteHeight, (event.clientY - rect.top) * scaleY)),
    };
  }

  private modifiers(event: MouseEvent | KeyboardEvent): number {
    return (
      (event.altKey ? 1 : 0) |
      (event.ctrlKey ? 2 : 0) |
      (event.metaKey ? 4 : 0) |
      (event.shiftKey ? 8 : 0)
    );
  }

  onMouse(event: MouseEvent, type: 'mousedown' | 'mouseup' | 'mousemove') {
    if (!this.hasFrame) return;
    if (type === 'mousemove') {
      // ~30 events/sec is plenty for hover states and keeps the socket light.
      const now = performance.now();
      if (now - this.lastMove < 33) return;
      this.lastMove = now;
    }
    if (type === 'mousedown') {
      (event.currentTarget as HTMLElement).focus();
      event.preventDefault();
    }
    const { x, y } = this.toRemote(event);
    const button = event.button === 2 ? 'right' : event.button === 1 ? 'middle' : 'left';
    this.send({
      kind: 'mouse',
      type,
      x,
      y,
      button: type === 'mousemove' ? undefined : button,
      clickCount: type === 'mousemove' ? 0 : Math.max(1, event.detail),
      modifiers: this.modifiers(event),
    });
  }

  onWheel(event: WheelEvent) {
    if (!this.hasFrame) return;
    event.preventDefault();
    const { x, y } = this.toRemote(event);
    this.send({
      kind: 'mouse',
      type: 'wheel',
      x,
      y,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      modifiers: this.modifiers(event),
    });
  }

  onKey(event: KeyboardEvent, type: 'keydown' | 'keyup') {
    if (!this.hasFrame) return;
    // Keep browser shortcuts like Cmd/Ctrl+R local; forward everything else.
    if ((event.metaKey || event.ctrlKey) && ['r', 'l', 't', 'w'].includes(event.key.toLowerCase())) {
      return;
    }
    event.preventDefault();
    this.send({
      kind: 'keyboard',
      type,
      key: event.key,
      code: event.code,
      text: type === 'keydown' && event.key.length === 1 && !event.ctrlKey && !event.metaKey ? event.key : undefined,
      modifiers: this.modifiers(event),
    });
  }

  private send(input: RemoteInputEvent) {
    this.codegen.sendInput(this.sessionId(), input);
  }
}
