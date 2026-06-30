import { Component, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Environment,
  GeneratedPageObjectArtifacts,
  PageObject,
} from '@playwright-platform/shared-types';
import { ProjectsService } from '../../core/services/projects.service';
import { EnvironmentsService } from '../../core/services/environments.service';
import { PageObjectsService } from '../../core/services/page-objects.service';
import { CodegenSocketService } from '../../core/services/codegen-socket.service';
import { apiErrorMessage } from '../../shared/utils/api-error.util';

@Component({
  selector: 'app-page-object-recorder',
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <div class="page-header">
      <div>
        <div class="breadcrumb">
          <a routerLink="/projects">Projects</a> /
          <a [routerLink]="['/projects', projectId]">{{ projectName() }}</a> /
          <a [routerLink]="['/projects', projectId, 'page-objects']">Page objects</a> /
          Recorder
        </div>
        <h2>Record page object</h2>
        <p class="empty">
          Record a screen or popup, convert to a Page Object class with LLM, review, then save.
          Re-select an existing page object to patch in new locators/actions.
        </p>
      </div>
    </div>

    <section class="card">
      <form class="form" [formGroup]="form">
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
          Re-record existing (optional)
          <select formControlName="targetPageObjectId" (change)="loadExistingPreview()">
            <option value="">New page object</option>
            @for (po of pageObjects(); track po.id) {
              <option [value]="po.id">{{ po.screenName }} (v{{ po.version }})</option>
            }
          </select>
          <span class="hint">Patch mode merges new recording into the selected class</span>
        </label>
        <label>
          Screen name
          <input formControlName="screenName" placeholder="Login page" />
        </label>
        <label>
          Component / popup name (optional)
          <input formControlName="componentName" placeholder="Forgot password modal" />
        </label>

        <div class="form-actions">
          @if (!recording()) {
            <button class="btn btn-primary" type="button" (click)="startRecording()" [disabled]="form.invalid">
              Start recording
            </button>
          } @else {
            <button class="btn btn-danger" type="button" (click)="stopRecording()">Stop recording</button>
          }
        </div>
      </form>

      @if (existingPreview()) {
        <h4>Current page object</h4>
        <pre class="code-output code-output-sm">{{ existingPreview() }}</pre>
      }

      @if (codegen.output()) {
        <h4>Raw recording</h4>
        <pre class="code-output code-output-sm">{{ codegen.output() }}</pre>
        @if (canGenerate()) {
          <div class="form-actions">
            <button class="btn btn-primary" type="button" (click)="generate()" [disabled]="generating()">
              {{ generating() ? 'Generating…' : 'Generate page object' }}
            </button>
          </div>
        }
      }

      @if (generateError()) {
        <p class="error">{{ generateError() }}</p>
      }
    </section>

    @if (generated()) {
      <section class="card">
        <h3>Review page object</h3>
        <p class="empty">{{ generated()!.summary }} (model: {{ generated()!.model }})</p>

        <div class="diff-grid">
          <div>
            <h4>Raw recording</h4>
            <pre class="code-output code-output-sm">{{ generated()!.rawRecording }}</pre>
          </div>
          <div>
            <h4>Generated class preview</h4>
            <pre class="code-output code-output-sm">{{ saveForm.getRawValue().pageObject }}</pre>
          </div>
        </div>

        <form class="form" [formGroup]="saveForm">
          <label>
            Class name
            <input formControlName="name" placeholder="LoginPage" />
          </label>
          <label>
            Screen name
            <input formControlName="screenName" />
          </label>
          <label>
            Page object source
            <textarea formControlName="pageObject" rows="16"></textarea>
          </label>

          @if (saveError()) {
            <p class="error">{{ saveError() }}</p>
          }
          @if (saveMessage()) {
            <p class="empty">{{ saveMessage() }}</p>
          }

          <div class="form-actions">
            <button class="btn btn-primary" type="button" (click)="save()" [disabled]="saveForm.invalid || saving()">
              {{ saving() ? 'Saving…' : saveLabel() }}
            </button>
            <button class="btn btn-secondary" type="button" (click)="generate()" [disabled]="generating()">
              Regenerate
            </button>
          </div>
        </form>
      </section>
    }
  `,
  styles: `
    .code-output {
      margin: 0.5rem 0 0;
      padding: 1rem;
      background: #1a1a2e;
      color: #e0e0e0;
      border-radius: 4px;
      font-size: 0.8125rem;
      overflow-x: auto;
      max-height: 20rem;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .code-output-sm {
      max-height: 12rem;
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
  `,
})
export class PageObjectRecorderComponent implements OnInit, OnDestroy {
  readonly codegen = inject(CodegenSocketService);
  private readonly pageObjectsService = inject(PageObjectsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectsService = inject(ProjectsService);
  private readonly environmentsService = inject(EnvironmentsService);
  private readonly fb = inject(FormBuilder);

  projectId = '';
  readonly projectName = signal('Project');
  readonly environments = signal<Environment[]>([]);
  readonly pageObjects = signal<PageObject[]>([]);
  readonly existingPreview = signal<string | null>(null);
  readonly recording = signal(false);
  readonly generating = signal(false);
  readonly saving = signal(false);
  readonly generated = signal<GeneratedPageObjectArtifacts | null>(null);
  readonly generateError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly saveMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    url: ['https://example.com', Validators.required],
    environmentId: [''],
    targetPageObjectId: [''],
    screenName: ['', Validators.required],
    componentName: [''],
  });

  readonly saveForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    screenName: ['', Validators.required],
    pageObject: ['', Validators.required],
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
      next: (p) => this.projectName.set(p.name),
    });

    this.environmentsService.listByProject(this.projectId).subscribe({
      next: (envs) => this.environments.set(envs),
    });

    this.pageObjectsService.listByProject(this.projectId).subscribe({
      next: (items) => this.pageObjects.set(items),
    });

    const reRecordId = this.route.snapshot.queryParamMap.get('reRecordId');
    if (reRecordId) {
      this.form.patchValue({ targetPageObjectId: reRecordId });
      this.loadExistingPreview();
    }
  }

  ngOnDestroy() {
    if (this.recording()) {
      const session = this.codegen.session();
      if (session) this.codegen.stop(session.id);
    }
    this.codegen.disconnect();
  }

  saveLabel(): string {
    return this.form.getRawValue().targetPageObjectId
      ? 'Save patched page object'
      : 'Save new page object';
  }

  canGenerate(): boolean {
    const session = this.codegen.session();
    return !!this.codegen.output().trim() && !!session && !this.recording();
  }

  applyEnvironment() {
    const env = this.environments().find((e) => e.id === this.form.getRawValue().environmentId);
    if (env) this.form.patchValue({ url: env.baseUrl });
  }

  loadExistingPreview() {
    const id = this.form.getRawValue().targetPageObjectId;
    if (!id) {
      this.existingPreview.set(null);
      return;
    }
    const po = this.pageObjects().find((item) => item.id === id);
    if (po) {
      this.form.patchValue({ screenName: po.screenName });
      this.saveForm.patchValue({ name: po.name, screenName: po.screenName });
    }
    this.pageObjectsService.getContent(id).subscribe({
      next: ({ content }) => this.existingPreview.set(content),
      error: () => this.existingPreview.set(null),
    });
  }

  startRecording() {
    if (this.form.invalid) return;
    const { url, targetPageObjectId, screenName } = this.form.getRawValue();
    this.recording.set(true);
    this.generated.set(null);
    this.generateError.set(null);
    this.saveError.set(null);
    this.codegen.reset();
    this.codegen.start(this.projectId, url, {
      mode: 'page-object',
      targetPageObjectId: targetPageObjectId || undefined,
    });
    this.saveForm.patchValue({ screenName });
  }

  stopRecording() {
    const session = this.codegen.session();
    if (session) this.codegen.stop(session.id);
    this.recording.set(false);
  }

  generate() {
    const session = this.codegen.session();
    if (!session) return;
    const { screenName, componentName } = this.form.getRawValue();

    this.generating.set(true);
    this.generateError.set(null);
    this.pageObjectsService
      .generate(session.id, {
        screenName,
        componentName: componentName || undefined,
      })
      .subscribe({
        next: (result) => {
          this.generated.set(result);
          this.saveForm.patchValue({
            name: result.className,
            screenName,
            pageObject: result.pageObject,
          });
          this.generating.set(false);
        },
        error: (err) => {
          this.generateError.set(apiErrorMessage(err, 'Page object generation failed.'));
          this.generating.set(false);
        },
      });
  }

  save() {
    if (this.saveForm.invalid) return;
    this.saving.set(true);
    this.saveError.set(null);
    const form = this.saveForm.getRawValue();
    const targetId = this.form.getRawValue().targetPageObjectId || undefined;

    this.pageObjectsService
      .save(this.projectId, {
        name: form.name,
        screenName: form.screenName,
        pageObject: form.pageObject,
        existingPageObjectId: targetId,
      })
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.saveMessage.set(`Saved v${result.version} → ${result.classFilePath}`);
          void this.router.navigate(['/projects', this.projectId, 'page-objects']);
        },
        error: (err) => {
          this.saveError.set(apiErrorMessage(err, 'Failed to save page object.'));
          this.saving.set(false);
        },
      });
  }
}
