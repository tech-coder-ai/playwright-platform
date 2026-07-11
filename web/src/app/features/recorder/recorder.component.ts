import { Component, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Environment,
  GeneratedTestArtifacts,
  TestSuiteSummary,
} from '@playwright-platform/shared-types';
import { ProjectsService } from '../../core/services/projects.service';
import { EnvironmentsService } from '../../core/services/environments.service';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { CodegenSocketService } from '../../core/services/codegen-socket.service';
import { CodegenApiService } from '../../core/services/codegen-api.service';
import { apiErrorMessage } from '../../shared/utils/api-error.util';
import { RemoteViewportComponent } from '../../shared/components/remote-viewport.component';

type ReviewTab = 'feature' | 'steps' | 'pageObject';

@Component({
  selector: 'app-recorder',
  imports: [RouterLink, ReactiveFormsModule, RemoteViewportComponent],
  template: `
    <div class="page-header">
      <div>
        <div class="breadcrumb">
          <a routerLink="/projects">Projects</a> /
          <a [routerLink]="['/projects', projectId]">{{ projectName() }}</a> /
          Recorder
        </div>
        <h2>Record test</h2>
        <p class="empty">
          Record browser actions → LLM generates Gherkin and step definitions → you review and save to a suite.
          Page objects are a separate feature; generated steps may import them when useful.
        </p>
      </div>
      <span class="connection-badge" [class.connected]="codegen.connected()">
        {{ codegen.connected() ? 'Connected' : 'Disconnected' }}
      </span>
    </div>

    <section class="card">
      <form class="inline-form" [formGroup]="form" (ngSubmit)="startRecording()">
        <label>
          Target URL
          <input formControlName="url" placeholder="https://example.com" />
        </label>
        <label>
          Environment preset
          <select formControlName="environmentId" (change)="applyEnvironment()">
            <option value="">Custom URL</option>
            @for (env of environments(); track env.id) {
              <option [value]="env.id">{{ env.name }} — {{ env.baseUrl }}</option>
            }
          </select>
        </label>
        <label>
          Recording browser
          <select formControlName="recorder">
            <option value="">Server default</option>
            <option value="remote">Streamed in this page (server-hosted)</option>
            <option value="local">Window on the API machine</option>
          </select>
        </label>
        @if (!recording()) {
          <button class="btn btn-primary" type="submit" [disabled]="form.invalid">Start recording</button>
        } @else {
          <button class="btn btn-danger" type="button" (click)="stopRecording()">Stop recording</button>
        }
      </form>

      @if (codegen.session()) {
        <p class="session-meta">
          Session <code>{{ codegen.session()!.id }}</code> ·
          <span class="status-badge" [class]="'status-' + codegen.session()!.status">{{
            codegen.session()!.status
          }}</span>
        </p>
      }

      @if (codegen.error()) {
        <p class="error">{{ codegen.error() }}</p>
      }

      @if (recording()) {
        @if (codegen.session()?.recorder === 'remote') {
          <div class="remote-stage">
            <app-remote-viewport [sessionId]="codegen.session()!.id" />
          </div>
        } @else {
          <p class="recording-hint">
            A Chromium window should open on the machine running the API. Interact with the page — code
            appears below as you go.
          </p>
        }
      }
    </section>

    <section class="card">
      <div class="output-header">
        <h3>Raw recording</h3>
        @if (codegen.output()) {
          <button class="btn btn-secondary" type="button" (click)="copyOutput()">Copy</button>
        }
      </div>
      @if (!codegen.output()) {
        <p class="empty">Start a recording to see Playwright codegen output.</p>
      } @else {
        <pre class="code-output">{{ codegen.output() }}</pre>
      }
      @if (copyMessage()) {
        <p class="empty">{{ copyMessage() }}</p>
      }

      @if (canGenerate()) {
        <div class="form-actions" style="margin-top: 1rem">
          <button
            class="btn btn-primary"
            type="button"
            (click)="generateTests()"
            [disabled]="generating()"
          >
            {{ generating() ? 'Generating…' : 'Generate with LLM' }}
          </button>
        </div>
      }
      @if (generateError()) {
        <p class="error">{{ generateError() }}</p>
      }
    </section>

    @if (generated()) {
      <section class="card">
        <h3>Review generated tests</h3>
        <p class="empty">{{ generated()!.summary }} (model: {{ generated()!.model }})</p>

        <div class="diff-grid">
          <div>
            <h4>Raw recording</h4>
            <pre class="code-output code-output-sm">{{ generated()!.rawRecording }}</pre>
          </div>
          <div>
            <h4>Generated feature (preview)</h4>
            <pre class="code-output code-output-sm">{{ reviewForm.getRawValue().featureFile }}</pre>
          </div>
        </div>

        <div class="tab-bar">
          @for (tab of reviewTabs; track tab.id) {
            <button
              type="button"
              class="tab-btn"
              [class.active]="activeTab() === tab.id"
              (click)="activeTab.set(tab.id)"
            >
              {{ tab.label }}
            </button>
          }
        </div>

        <form class="form" [formGroup]="reviewForm">
          @if (activeTab() === 'feature') {
            <label>
              Feature file
              <textarea formControlName="featureFile" rows="14"></textarea>
            </label>
          }
          @if (activeTab() === 'steps') {
            <label>
              Step definitions
              <textarea formControlName="stepDefinitions" rows="14"></textarea>
            </label>
          }
          @if (activeTab() === 'pageObject') {
            <label>
              Page object
              <textarea formControlName="pageObject" rows="14"></textarea>
            </label>
          }

          <label>
            Target suite
            <select formControlName="suiteId">
              <option value="">Select suite…</option>
              @for (suite of suites(); track suite.id) {
                <option [value]="suite.id">{{ suite.name }}</option>
              }
            </select>
          </label>
          <label>
            Test case name
            <input formControlName="testCaseName" placeholder="User visits homepage" />
          </label>
          <label>
            Screen name
            <input formControlName="screenName" placeholder="Homepage" />
          </label>

          @if (saveError()) {
            <p class="error">{{ saveError() }}</p>
          }
          @if (saveMessage()) {
            <p class="empty">{{ saveMessage() }}</p>
          }

          <div class="form-actions">
            <button
              class="btn btn-primary"
              type="button"
              (click)="saveTests()"
              [disabled]="reviewForm.invalid || saving()"
            >
              {{ saving() ? 'Saving…' : 'Save approved tests' }}
            </button>
            <button class="btn btn-secondary" type="button" (click)="generateTests()" [disabled]="generating()">
              Regenerate
            </button>
          </div>
        </form>
      </section>
    }
  `,
  styles: `
    .connection-badge {
      font-size: 0.8125rem;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      background: var(--danger-bg);
      color: var(--danger-text);

      &.connected {
        background: var(--success-bg);
        color: var(--success-text);
      }
    }

    .session-meta {
      margin: 0.75rem 0 0;
      font-size: 0.875rem;
    }

    .recording-hint {
      margin: 0.75rem 0 0;
      font-size: 0.875rem;
      color: var(--warning-text);
    }

    .remote-stage {
      margin-top: 1rem;
    }

    .output-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;

      h3 {
        margin: 0;
      }
    }

    .code-output {
      margin: 0;
      padding: 1rem;
      background: var(--code-bg);
      color: var(--code-text);
      border-radius: 4px;
      font-size: 0.8125rem;
      overflow-x: auto;
      max-height: 28rem;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .code-output-sm {
      max-height: 14rem;
    }

    .diff-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
      gap: 1rem;
      margin: 1rem 0;

      h4 {
        margin: 0 0 0.5rem;
        font-size: 0.875rem;
      }
    }

    .tab-bar {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .tab-btn {
      padding: 0.375rem 0.75rem;
      border: 1px solid var(--border-strong);
      border-radius: 4px;
      background: var(--surface);
      cursor: pointer;
      font: inherit;
      font-size: 0.875rem;

      &.active {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--accent-contrast);
      }
    }

    .status-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-recording,
    .status-starting {
      background: var(--warning-bg);
      color: var(--warning-text);
    }

    .status-stopped {
      background: var(--neutral-bg);
      color: var(--neutral-text);
    }

    .status-error {
      background: var(--danger-bg);
      color: var(--danger-text);
    }

    code {
      font-size: 0.8125rem;
    }
  `,
})
export class RecorderComponent implements OnInit, OnDestroy {
  readonly codegen = inject(CodegenSocketService);
  private readonly codegenApi = inject(CodegenApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectsService = inject(ProjectsService);
  private readonly environmentsService = inject(EnvironmentsService);
  private readonly testSuitesService = inject(TestSuitesService);
  private readonly fb = inject(FormBuilder);

  projectId = '';
  readonly projectName = signal('Project');
  readonly environments = signal<Environment[]>([]);
  readonly suites = signal<TestSuiteSummary[]>([]);
  readonly recording = signal(false);
  readonly generating = signal(false);
  readonly saving = signal(false);
  readonly copyMessage = signal<string | null>(null);
  readonly generateError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly saveMessage = signal<string | null>(null);
  readonly generated = signal<GeneratedTestArtifacts | null>(null);
  readonly activeTab = signal<ReviewTab>('feature');

  readonly reviewTabs: Array<{ id: ReviewTab; label: string }> = [
    { id: 'feature', label: 'Feature file' },
    { id: 'steps', label: 'Step definitions' },
    { id: 'pageObject', label: 'Page object' },
  ];

  readonly form = this.fb.nonNullable.group({
    url: ['https://example.com', Validators.required],
    environmentId: [''],
    recorder: [''],
  });

  readonly reviewForm = this.fb.nonNullable.group({
    featureFile: ['', Validators.required],
    stepDefinitions: ['', Validators.required],
    pageObject: ['', Validators.required],
    suiteId: ['', Validators.required],
    testCaseName: ['', Validators.required],
    screenName: ['', Validators.required],
  });

  private readonly syncRecordingState = effect(() => {
    const session = this.codegen.session();
    if (session && (session.status === 'stopped' || session.status === 'error')) {
      this.recording.set(false);
    }
  });

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
    this.codegen.connect();

    this.projectsService.get(this.projectId).subscribe({
      next: (project) => this.projectName.set(project.name),
      error: () => this.projectName.set('Project'),
    });

    this.environmentsService.listByProject(this.projectId).subscribe({
      next: (envs) => this.environments.set(envs),
    });

    this.testSuitesService.listByProject(this.projectId).subscribe({
      next: (suites) => {
        this.suites.set(suites);
        const suiteId = this.route.snapshot.queryParamMap.get('suiteId');
        if (suiteId && suites.some((suite) => suite.id === suiteId)) {
          this.reviewForm.patchValue({ suiteId });
        }
      },
    });
  }

  ngOnDestroy() {
    if (this.recording()) {
      const session = this.codegen.session();
      if (session) this.codegen.stop(session.id);
    }
    this.codegen.disconnect();
  }

  canGenerate(): boolean {
    const session = this.codegen.session();
    return !!this.codegen.output().trim() && !!session && !this.recording() && session.status !== 'recording';
  }

  applyEnvironment() {
    const envId = this.form.getRawValue().environmentId;
    const env = this.environments().find((item) => item.id === envId);
    if (env) {
      this.form.patchValue({ url: env.baseUrl });
    }
  }

  startRecording() {
    if (this.form.invalid) return;
    this.recording.set(true);
    this.codegen.reset();
    this.generated.set(null);
    this.generateError.set(null);
    this.saveError.set(null);
    this.saveMessage.set(null);
    const { url, recorder } = this.form.getRawValue();
    this.codegen.start(this.projectId, url, {
      ...(recorder ? { recorder: recorder as 'local' | 'remote' } : {}),
    });
  }

  stopRecording() {
    const session = this.codegen.session();
    if (session) {
      this.codegen.stop(session.id);
    }
    this.recording.set(false);
  }

  generateTests() {
    const session = this.codegen.session();
    if (!session) return;

    this.generating.set(true);
    this.generateError.set(null);
    this.codegenApi.generate(session.id).subscribe({
      next: (result) => {
        this.generated.set(result);
        this.reviewForm.patchValue({
          featureFile: result.featureFile,
          stepDefinitions: result.stepDefinitions,
          pageObject: result.pageObject,
          testCaseName: this.reviewForm.getRawValue().testCaseName || 'Generated test',
          screenName: this.reviewForm.getRawValue().screenName || 'Recorded screen',
        });
        this.generating.set(false);
        this.activeTab.set('feature');
      },
      error: (err) => {
        this.generateError.set(apiErrorMessage(err, 'LLM generation failed.'));
        this.generating.set(false);
      },
    });
  }

  saveTests() {
    if (this.reviewForm.invalid) return;
    const session = this.codegen.session();
    if (!session) return;

    this.saving.set(true);
    this.saveError.set(null);
    this.saveMessage.set(null);

    const form = this.reviewForm.getRawValue();
    this.codegenApi
      .save(this.projectId, session.id, {
        suiteId: form.suiteId,
        testCaseName: form.testCaseName,
        screenName: form.screenName,
        featureFile: form.featureFile,
        stepDefinitions: form.stepDefinitions,
        pageObject: form.pageObject,
      })
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.saveMessage.set(
            `Saved: ${result.featurePath}, ${result.stepDefinitionsPath}, ${result.pageObjectPath}`,
          );
          void this.router.navigate(['/projects', this.projectId, 'suites', form.suiteId]);
        },
        error: (err) => {
          this.saveError.set(apiErrorMessage(err, 'Failed to save generated tests.'));
          this.saving.set(false);
        },
      });
  }

  async copyOutput() {
    const text = this.codegen.output();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    this.copyMessage.set('Copied to clipboard.');
    setTimeout(() => this.copyMessage.set(null), 2000);
  }
}
