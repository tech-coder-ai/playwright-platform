import { Component, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  UNIT_TEST_LANGUAGE_LABELS,
  UNIT_TEST_PROMPTS,
  UnitTestLanguage,
  UnitTestPromptTemplate,
  buildUnitTestPrompt,
  getUnitTestPromptsForLanguage,
} from '@playwright-platform/shared-types';

@Component({
  selector: 'app-unit-test-prompts',
  imports: [ReactiveFormsModule],
  styles: `
    .page-subtitle {
      margin: 0.25rem 0 0;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .lang-tabs {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    .lang-tab {
      padding: 0.5rem 1rem;
      border: 1px solid var(--border-strong);
      border-radius: 999px;
      background: var(--surface);
      font: inherit;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      color: var(--text-secondary);
      transition: all 0.15s ease;

      &:hover {
        border-color: var(--accent);
        color: var(--accent-soft-text);
      }

      &.active {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--accent-contrast);
      }
    }

    .prompt-grid {
      display: grid;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .prompt-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem;
      cursor: pointer;
      background: var(--surface-raised);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;

      &:hover {
        border-color: var(--accent);
      }

      &.selected {
        border-color: var(--accent);
        background: var(--accent-soft);
        box-shadow: 0 0 0 1px var(--accent);
      }

      h4 {
        margin: 0 0 0.35rem;
        font-size: 0.95rem;
        font-weight: 600;
      }

      p {
        margin: 0 0 0.5rem;
        font-size: 0.8125rem;
        color: var(--text-muted);
        line-height: 1.45;
      }
    }

    .prompt-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .meta-chip {
      font-size: 0.7rem;
      font-weight: 500;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      background: var(--border);
      color: var(--text-secondary);
    }

    .meta-chip.framework {
      background: var(--accent-soft);
      color: var(--accent-soft-text);
    }

    .meta-chip.coverage {
      background: var(--success-bg);
      color: var(--success-text);
    }

    .best-for {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin-top: 0.5rem;
    }

    .best-for span {
      font-size: 0.68rem;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      background: var(--divider);
      color: var(--text-muted);
    }

    .builder-layout {
      display: grid;
      gap: 1.25rem;
    }

    .config-card .form {
      max-width: none;
    }

    .preview-panel {
      margin-top: 0;
    }

    .prompt-output {
      width: 100%;
      margin: 0;
      padding: 1rem 1.125rem;
      min-height: 28rem;
      max-height: min(70vh, 48rem);
      overflow: auto;
      background: var(--surface-raised);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.75rem;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--text);
    }

    .prompt-meta-line {
      margin: 0 0 0.75rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .command-box {
      margin-top: 0.5rem;
      padding: 0.75rem;
      background: var(--code-bg);
      border-radius: 8px;
      color: var(--border);
      font-family: ui-monospace, monospace;
      font-size: 0.75rem;
      overflow-x: auto;
    }

    .command-box + .command-box {
      margin-top: 0.5rem;
    }

    .command-label {
      display: block;
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.35rem;
    }

    .copy-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .copy-feedback {
      font-size: 0.75rem;
      color: var(--success-text);
      font-weight: 500;
    }

    .tips-list {
      margin: 0;
      padding-left: 1.1rem;
      font-size: 0.8125rem;
      color: var(--text-muted);
      line-height: 1.55;

      li + li {
        margin-top: 0.35rem;
      }
    }

    .command-row {
      display: grid;
      gap: 1.25rem;
      margin-top: 1.25rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--divider);
    }

    @media (min-width: 900px) {
      .command-row {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
  template: `
    <div class="page-header">
      <div>
        <h2>Unit test prompts</h2>
        <p class="page-subtitle">
          Curated AI prompts for Angular, Java, and Python — designed for ≥ 80% coverage with genuine
          positive, negative, and edge-case tests.
        </p>
      </div>
    </div>

    <section class="card">
      <h3>Choose framework</h3>
      <div class="lang-tabs">
        @for (lang of languages; track lang) {
          <button
            type="button"
            class="lang-tab"
            [class.active]="language() === lang"
            (click)="selectLanguage(lang)"
          >
            {{ labels[lang] }}
          </button>
        }
      </div>

      <h3>Choose prompt template</h3>
      <div class="prompt-grid">
        @for (prompt of promptsForLanguage(); track prompt.id) {
          <article
            class="prompt-card"
            [class.selected]="selectedPromptId() === prompt.id"
            (click)="selectPrompt(prompt.id)"
            (keydown.enter)="selectPrompt(prompt.id)"
            tabindex="0"
            role="button"
          >
            <h4>{{ prompt.name }}</h4>
            <p>{{ prompt.description }}</p>
            <div class="prompt-meta">
              <span class="meta-chip framework">{{ prompt.framework }}</span>
              <span class="meta-chip coverage">{{ prompt.coverageTarget }}</span>
            </div>
            <div class="best-for">
              @for (tag of prompt.bestFor; track tag) {
                <span>{{ tag }}</span>
              }
            </div>
          </article>
        }
      </div>
    </section>

    @if (selectedPrompt(); as prompt) {
      <div class="builder-layout">
        <section class="card config-card">
          <h3>Configure prompt</h3>
          <form class="form" [formGroup]="form">
            <label>
              File or module name
              <input
                formControlName="target"
                placeholder="e.g. UserService, app/services/order_service.py, src/app/dashboard/"
              />
              <span class="hint">The class, file path, or module the tests should target.</span>
            </label>

            <label>
              Source code (optional)
              <textarea
                formControlName="sourceCode"
                rows="8"
                placeholder="Paste the source code here so the AI can analyse branches and dependencies."
              ></textarea>
            </label>

            <label>
              Additional context (optional)
              <textarea
                formControlName="additionalContext"
                rows="3"
                placeholder="e.g. Use existing test conventions, mock Redis, skip integration tests..."
              ></textarea>
            </label>
          </form>

          <div class="command-row">
            <div>
              <h3>Run commands</h3>
              <div class="command-box">
                <span class="command-label">Run tests</span>
                {{ resolvedRunCommand() }}
              </div>
              <div class="command-box">
                <span class="command-label">Coverage gate</span>
                {{ resolvedCoverageCommand() }}
              </div>
            </div>
            <div>
              <h3>Tips</h3>
              <ul class="tips-list">
                <li><strong>Best results:</strong> paste full source code and your framework version (e.g. Angular 19 + Vitest, Java 21 + Maven).</li>
                <li><strong>Two-pass workflow:</strong> run Comprehensive first, then Boundary & error pass to close branch gaps research shows LLMs miss.</li>
                <li>Review generated tests against the spec — AI validates behaviour, not intent.</li>
                <li>Run the coverage command and add tests for red branches in the HTML/term-missing report.</li>
                <li>Enforce thresholds in CI (Karma/Vitest coverage, JaCoCo, pytest --cov-fail-under).</li>
              </ul>
            </div>
          </div>
        </section>

        <section class="card preview-panel">
          <div class="copy-row">
            <div>
              <h3>Generated prompt</h3>
              <p class="prompt-meta-line">
                {{ promptLineCount() }} lines · scroll to read the full prompt, or use Copy prompt
              </p>
            </div>
            <div>
              @if (copyFeedback()) {
                <span class="copy-feedback">{{ copyFeedback() }}</span>
              }
              <button class="btn btn-primary" type="button" (click)="copyPrompt()">Copy prompt</button>
            </div>
          </div>
          <pre class="prompt-output">{{ assembledPrompt() }}</pre>
        </section>
      </div>
    }
  `,
})
export class UnitTestPromptsComponent {
  private readonly fb = new FormBuilder();

  readonly languages: UnitTestLanguage[] = ['angular', 'java', 'python'];
  readonly labels = UNIT_TEST_LANGUAGE_LABELS;

  readonly language = signal<UnitTestLanguage>('angular');
  readonly selectedPromptId = signal<string>('angular-vitest');
  readonly copyFeedback = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    target: ['', Validators.required],
    sourceCode: [''],
    additionalContext: [''],
  });

  readonly promptsForLanguage = computed(() => getUnitTestPromptsForLanguage(this.language()));

  readonly selectedPrompt = computed(() =>
    UNIT_TEST_PROMPTS.find((prompt) => prompt.id === this.selectedPromptId()) ?? null,
  );

  readonly assembledPrompt = computed(() => {
    const prompt = this.selectedPrompt();
    if (!prompt) return '';
    const { target, sourceCode, additionalContext } = this.formValues();
    return buildUnitTestPrompt(prompt, target, { sourceCode, additionalContext });
  });

  readonly resolvedRunCommand = computed(() =>
    this.resolveCommand(this.selectedPrompt()?.runCommand ?? ''),
  );

  readonly resolvedCoverageCommand = computed(() =>
    this.resolveCommand(this.selectedPrompt()?.coverageCommand ?? ''),
  );

  readonly promptLineCount = computed(() => {
    const text = this.assembledPrompt();
    return text ? text.split('\n').length : 0;
  });

  private readonly formValues = signal(this.form.getRawValue());

  constructor() {
    this.form.valueChanges.subscribe(() => {
      this.formValues.set(this.form.getRawValue());
    });
    this.formValues.set(this.form.getRawValue());
  }

  selectLanguage(language: UnitTestLanguage): void {
    this.language.set(language);
    const prompts = getUnitTestPromptsForLanguage(language);
    const preferred =
      language === 'angular'
        ? prompts.find((p) => p.id === 'angular-vitest') ?? prompts[0]
        : prompts.find((p) => p.id.includes('comprehensive')) ?? prompts[0];
    if (preferred) {
      this.selectedPromptId.set(preferred.id);
    }
  }

  selectPrompt(id: string): void {
    this.selectedPromptId.set(id);
  }

  async copyPrompt(): Promise<void> {
    const text = this.assembledPrompt();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copyFeedback.set('Copied!');
      setTimeout(() => this.copyFeedback.set(null), 2000);
    } catch {
      this.copyFeedback.set('Copy failed — select text manually');
    }
  }

  private resolveCommand(command: string): string {
    const target = this.formValues().target.trim() || '[target]';
    const fileSlug = target
      .split(/[/\\]/)
      .pop()
      ?.replace(/\.(ts|java|py)$/i, '') ?? target;
    return command.replaceAll('{{TARGET}}', fileSlug);
  }
}
