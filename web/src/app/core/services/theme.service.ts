import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'pt-theme';

/**
 * Theme management: light / dark / follow-OS. The resolved theme is stamped on
 * <html data-theme="..."> which the token stylesheet keys off. An inline
 * script in index.html applies the stored value before Angular boots so the
 * first paint is already in the right theme.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.restore());
  readonly resolved = signal<'light' | 'dark'>('light');

  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    this.media.addEventListener('change', () => {
      if (this.mode() === 'system') this.apply();
    });
    effect(() => {
      // re-run whenever the mode changes
      this.mode();
      this.apply();
    });
  }

  setMode(mode: ThemeMode) {
    this.mode.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  cycle() {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    this.setMode(order[(order.indexOf(this.mode()) + 1) % order.length]);
  }

  private restore(): ThemeMode {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  }

  private apply() {
    const mode = this.mode();
    const resolved = mode === 'system' ? (this.media.matches ? 'dark' : 'light') : mode;
    this.resolved.set(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }
}
