import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import { getTestsRoot } from '../test-runner/paths.util';
import { resolveChromiumExecutablePath } from '../common/browser-env.util';
import {
  resolveChromiumLibrary,
  type PlaywrightBrowser,
  type PlaywrightBrowserContext,
  type PlaywrightCdpSession,
  type PlaywrightPage,
} from '../common/playwright-library.util';
import type { RemoteInputEvent, RemoteKeyboardEvent, RemoteMouseEvent } from '@playwright-platform/shared-types';

export interface RemoteRecorderOptions {
  url: string;
  outputFile: string;
  viewport: { width: number; height: number };
  onFrame: (frame: { data: string; width: number; height: number }) => void;
  onError: (message: string) => void;
}

/** Windows virtual key codes for the non-printable keys CDP needs them for. */
const VIRTUAL_KEY_CODES: Record<string, number> = {
  Backspace: 8,
  Tab: 9,
  Enter: 13,
  Shift: 16,
  Control: 17,
  Alt: 18,
  Escape: 27,
  ' ': 32,
  PageUp: 33,
  PageDown: 34,
  End: 35,
  Home: 36,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  Delete: 46,
  Meta: 91,
};

/**
 * A server-side recording browser streamed to the web UI.
 *
 * - Chromium runs headless on the machine hosting the API.
 * - Playwright's programmatic recorder (`recorderMode: 'api'`, the channel
 *   behind the VS Code "record at cursor" feature) is enabled on the context;
 *   it emits one code snippet per user action. This class assembles them
 *   into a playwright-test file and writes it to
 *   {@link RemoteRecorderOptions.outputFile}, so the file-polling +
 *   LLM pipeline downstream is identical to the local codegen flow.
 * - The viewport is streamed to the web UI as JPEG frames via CDP
 *   `Page.startScreencast`; user mouse/keyboard input arrives back and is
 *   dispatched via CDP `Input.*`, which produces trusted events the recorder
 *   captures like real user interaction.
 */
export class RemoteRecorderSession {
  private readonly logger = new Logger(RemoteRecorderSession.name);
  private browser?: PlaywrightBrowser;
  private context?: PlaywrightBrowserContext;
  private page?: PlaywrightPage;
  private cdp?: PlaywrightCdpSession;
  private viewport: { width: number; height: number };
  private closed = false;
  /** Code snippets for recorded actions, in order; updates replace the last entry. */
  private actionCode: string[] = [];
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: RemoteRecorderOptions) {
    this.viewport = { ...options.viewport };
  }

  async start(): Promise<void> {
    const chromium = resolveChromiumLibrary(getTestsRoot());
    const executablePath = resolveChromiumExecutablePath();
    const extraArgs = (process.env['CODEGEN_BROWSER_ARGS'] ?? '')
      .split(' ')
      .map((arg) => arg.trim())
      .filter(Boolean);

    this.browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      ...(extraArgs.length ? { args: extraArgs } : {}),
    });

    try {
      this.context = await this.browser.newContext({ viewport: this.viewport });

      // Private API (the channel behind VS Code's recorder integration). If a
      // future Playwright upgrade removes it, fail the session loudly rather
      // than recording nothing.
      const enableRecorder = (
        this.context as unknown as {
          _enableRecorder?: (
            params: Record<string, unknown>,
            eventSink?: Record<string, unknown>,
          ) => Promise<void>;
        }
      )._enableRecorder;
      if (typeof enableRecorder !== 'function') {
        throw new Error(
          'This Playwright version does not expose the recorder API needed for remote recording. Use CODEGEN_RECORDER=local or pin a supported Playwright version.',
        );
      }
      await enableRecorder.call(
        this.context,
        { language: 'playwright-test', mode: 'recording', recorderMode: 'api' },
        {
          actionAdded: (_page: unknown, _data: unknown, code: string) => {
            this.actionCode.push(code);
            this.flushRecording();
          },
          actionUpdated: (_page: unknown, _data: unknown, code: string) => {
            this.actionCode[Math.max(0, this.actionCode.length - 1)] = code;
            this.flushRecording();
          },
          signalAdded: () => undefined,
        },
      );

      this.page = await this.context.newPage();
      await this.attachScreencast(this.page);

      // Do not block session start on the target app: enterprise first loads
      // can take minutes and the user watches progress through the stream.
      void this.page
        .goto(this.options.url, { waitUntil: 'commit', timeout: 180_000 })
        .catch((error: unknown) => {
          if (!this.closed) {
            this.options.onError(
              `Navigation to ${this.options.url} failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        });
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  /**
   * Serializes the recorded actions into a playwright-test file — the same
   * shape `playwright codegen --target=playwright-test` produces — so the
   * downstream polling, review UI, and LLM prompts see a familiar format.
   */
  private composeRecording(): string {
    const body = this.actionCode
      .map((code) => code.replace(/\s+$/g, ''))
      .filter((code) => code.trim().length > 0)
      .map((code) => (code.startsWith('  ') ? code : `  ${code}`))
      .join('\n');

    return [
      "import { test, expect } from '@playwright/test';",
      '',
      "test('recorded flow', async ({ page }) => {",
      body,
      '});',
      '',
    ].join('\n');
  }

  /** Serialized writes so a fast action burst cannot interleave file writes. */
  private flushRecording(): void {
    const content = this.composeRecording();
    this.writeQueue = this.writeQueue
      .then(() => fs.writeFile(this.options.outputFile, content, 'utf8'))
      .catch((error) =>
        this.logger.warn(
          `failed to write recording: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
  }

  private async attachScreencast(page: PlaywrightPage): Promise<void> {
    if (!this.context) return;
    this.cdp = await this.context.newCDPSession(page);

    this.cdp.on(
      'Page.screencastFrame',
      (payload: { data: string; sessionId: number; metadata: { deviceWidth: number; deviceHeight: number } }) => {
        this.options.onFrame({
          data: payload.data,
          width: payload.metadata.deviceWidth,
          height: payload.metadata.deviceHeight,
        });
        // Every frame must be acked or Chromium stops sending them.
        this.cdp
          ?.send('Page.screencastFrameAck', { sessionId: payload.sessionId })
          .catch(() => undefined);
      },
    );

    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: Number(process.env['CODEGEN_STREAM_QUALITY'] ?? 60),
      maxWidth: this.viewport.width,
      maxHeight: this.viewport.height,
      everyNthFrame: 1,
    });
  }

  async dispatchInput(event: RemoteInputEvent): Promise<void> {
    if (!this.cdp || this.closed) return;
    try {
      if (event.kind === 'mouse') {
        await this.dispatchMouse(event);
      } else {
        await this.dispatchKeyboard(event);
      }
    } catch (error) {
      // Input against a page mid-navigation is expected to fail sometimes;
      // log at debug and keep the stream alive.
      this.logger.debug(
        `input dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async dispatchMouse(event: RemoteMouseEvent): Promise<void> {
    const typeMap = {
      mousedown: 'mousePressed',
      mouseup: 'mouseReleased',
      mousemove: 'mouseMoved',
      wheel: 'mouseWheel',
    } as const;

    await this.cdp!.send('Input.dispatchMouseEvent', {
      type: typeMap[event.type],
      x: event.x,
      y: event.y,
      button: event.button ?? (event.type === 'mousemove' || event.type === 'wheel' ? 'none' : 'left'),
      clickCount: event.clickCount ?? (event.type === 'mousedown' || event.type === 'mouseup' ? 1 : 0),
      deltaX: event.deltaX ?? 0,
      deltaY: event.deltaY ?? 0,
      modifiers: event.modifiers ?? 0,
      pointerType: 'mouse',
    });
  }

  private async dispatchKeyboard(event: RemoteKeyboardEvent): Promise<void> {
    const text = event.type === 'keydown' ? this.printableText(event) : undefined;
    await this.cdp!.send('Input.dispatchKeyEvent', {
      // keyDown with text produces the char/input events; without text Chrome
      // needs rawKeyDown semantics but keyDown works for both cases here.
      type: event.type === 'keydown' ? (text ? 'keyDown' : 'rawKeyDown') : 'keyUp',
      key: event.key,
      code: event.code,
      ...(text ? { text, unmodifiedText: text } : {}),
      windowsVirtualKeyCode: this.virtualKeyCode(event),
      nativeVirtualKeyCode: this.virtualKeyCode(event),
      modifiers: event.modifiers ?? 0,
    });
  }

  private printableText(event: RemoteKeyboardEvent): string | undefined {
    if (event.text) return event.text;
    if (event.key === 'Enter') return '\r';
    // Ctrl/Meta chords must not insert text.
    if ((event.modifiers ?? 0) & (2 | 4)) return undefined;
    return event.key.length === 1 ? event.key : undefined;
  }

  private virtualKeyCode(event: RemoteKeyboardEvent): number | undefined {
    if (VIRTUAL_KEY_CODES[event.key] !== undefined) return VIRTUAL_KEY_CODES[event.key];
    if (event.key.length === 1) return event.key.toUpperCase().charCodeAt(0);
    return undefined;
  }

  async resize(width: number, height: number): Promise<void> {
    if (!this.page || this.closed) return;
    const clamped = {
      width: Math.min(Math.max(Math.round(width), 320), 3840),
      height: Math.min(Math.max(Math.round(height), 240), 2160),
    };
    this.viewport = clamped;
    await this.page.setViewportSize(clamped);
    // Restart the screencast so frame scaling matches the new viewport.
    await this.cdp?.send('Page.stopScreencast').catch(() => undefined);
    await this.cdp
      ?.send('Page.startScreencast', {
        format: 'jpeg',
        quality: Number(process.env['CODEGEN_STREAM_QUALITY'] ?? 60),
        maxWidth: clamped.width,
        maxHeight: clamped.height,
        everyNthFrame: 1,
      })
      .catch(() => undefined);
  }

  getViewport(): { width: number; height: number } {
    return { ...this.viewport };
  }

  /** Closes the browser after flushing the final recording to disk. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.flushRecording();
    await this.writeQueue;
    try {
      await this.cdp?.send('Page.stopScreencast').catch(() => undefined);
      await this.context?.close();
    } catch {
      // Context may already be gone (browser crashed / killed).
    }
    try {
      await this.browser?.close();
    } catch {
      // Ignore double-close.
    }
  }
}
