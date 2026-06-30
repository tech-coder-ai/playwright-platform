import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TestCase, TestCaseType } from '@playwright-platform/shared-types';
import { ProjectsService } from '../../core/services/projects.service';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { TestCasesService } from '../../core/services/test-cases.service';
import { apiErrorMessage } from '../../shared/utils/api-error.util';

type EditorTab = 'feature' | 'steps' | 'pageObject' | 'spec';

@Component({
  selector: 'app-test-case-editor',
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    @if (loading()) {
      <p class="empty">Loading test source…</p>
    } @else if (error()) {
      <p class="error">{{ error() }}</p>
    } @else if (testCase()) {
      <div class="page-header">
        <div>
          <div class="breadcrumb">
            <a routerLink="/projects">Projects</a> /
            <a [routerLink]="['/projects', projectId]">{{ projectName() }}</a> /
            <a [routerLink]="['/projects', projectId, 'suites', suiteId]">{{ suiteName() }}</a> /
            Edit source
          </div>
          <h2>{{ testCase()!.name }}</h2>
          <p class="subtitle">
            Edit generated files on disk. Changes take effect on the next suite run.
          </p>
        </div>
        <a [routerLink]="['/projects', projectId, 'suites', suiteId]" class="btn btn-secondary">
          Back to suite
        </a>
      </div>

      <section class="card">
        @if (testCase()!.type === 'gherkin') {
          <div class="tab-bar">
            @for (tab of gherkinTabs; track tab.id) {
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

          <form class="form editor-form" [formGroup]="gherkinForm" (ngSubmit)="save()">
            @if (activeTab() === 'feature') {
              <label>
                Feature file
                <code class="path-hint">{{ paths().featurePath }}</code>
                <textarea formControlName="featureFile" rows="18" spellcheck="false"></textarea>
              </label>
            }
            @if (activeTab() === 'steps') {
              <label>
                Step definitions
                <code class="path-hint">{{ paths().stepDefinitionsPath }}</code>
                <textarea formControlName="stepDefinitions" rows="18" spellcheck="false"></textarea>
              </label>
            }
            @if (activeTab() === 'pageObject') {
              <label>
                Page object
                <code class="path-hint">{{ paths().pageObjectPath }}</code>
                <textarea formControlName="pageObject" rows="18" spellcheck="false"></textarea>
              </label>
            }

            @if (saveError()) {
              <p class="error">{{ saveError() }}</p>
            }
            @if (saveMessage()) {
              <p class="success">{{ saveMessage() }}</p>
            }

            <div class="form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="gherkinForm.invalid || saving()">
                {{ saving() ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </form>
        } @else {
          <form class="form editor-form" [formGroup]="specForm" (ngSubmit)="save()">
            <label>
              Playwright spec
              <code class="path-hint">{{ paths().specPath }}</code>
              <textarea formControlName="specFile" rows="22" spellcheck="false"></textarea>
            </label>

            @if (saveError()) {
              <p class="error">{{ saveError() }}</p>
            }
            @if (saveMessage()) {
              <p class="success">{{ saveMessage() }}</p>
            }

            <div class="form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="specForm.invalid || saving()">
                {{ saving() ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </form>
        }
      </section>
    }
  `,
  styles: `
    .subtitle {
      margin: 0.375rem 0 0;
      color: #64748b;
      font-size: 0.875rem;
    }

    .tab-bar {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .tab-btn {
      padding: 0.5rem 0.875rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 500;
      color: #64748b;

      &.active {
        background: #4f46e5;
        border-color: #4f46e5;
        color: #fff;
      }
    }

    .editor-form label {
      max-width: none;
    }

    .path-hint {
      display: block;
      font-size: 0.75rem;
      color: #64748b;
      font-weight: 400;
      margin-bottom: 0.25rem;
    }

    textarea {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.8125rem;
      line-height: 1.5;
      tab-size: 2;
    }

    .success {
      color: #15803d;
      font-size: 0.875rem;
      margin: 0;
    }
  `,
})
export class TestCaseEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly projectsService = inject(ProjectsService);
  private readonly testSuitesService = inject(TestSuitesService);
  private readonly testCasesService = inject(TestCasesService);
  private readonly fb = inject(FormBuilder);

  projectId = '';
  suiteId = '';
  testCaseId = '';

  readonly projectName = signal('Project');
  readonly suiteName = signal('Suite');
  readonly testCase = signal<TestCase | null>(null);
  readonly paths = signal<{
    featurePath?: string;
    stepDefinitionsPath?: string;
    pageObjectPath?: string;
    specPath?: string;
  }>({});
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly saveMessage = signal<string | null>(null);
  readonly activeTab = signal<EditorTab>('feature');

  readonly gherkinTabs: Array<{ id: EditorTab; label: string }> = [
    { id: 'feature', label: 'Feature file' },
    { id: 'steps', label: 'Step definitions' },
    { id: 'pageObject', label: 'Page object' },
  ];

  readonly gherkinForm = this.fb.nonNullable.group({
    featureFile: ['', Validators.required],
    stepDefinitions: ['', Validators.required],
    pageObject: ['', Validators.required],
  });

  readonly specForm = this.fb.nonNullable.group({
    specFile: ['', Validators.required],
  });

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
    this.suiteId = this.route.snapshot.paramMap.get('suiteId') ?? '';
    this.testCaseId = this.route.snapshot.paramMap.get('testCaseId') ?? '';

    this.projectsService.get(this.projectId).subscribe({
      next: (p) => this.projectName.set(p.name),
      error: () => this.projectName.set('Project'),
    });

    this.testSuitesService.get(this.suiteId).subscribe({
      next: (s) => this.suiteName.set(s.name),
      error: () => this.suiteName.set('Suite'),
    });

    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);

    this.testCasesService.get(this.testCaseId).subscribe({
      next: (testCase) => {
        this.testCase.set(testCase);
        this.loadSource(testCase.type);
      },
      error: () => {
        this.error.set('Test case not found.');
        this.loading.set(false);
      },
    });
  }

  private loadSource(type: TestCaseType) {
    this.testCasesService.getSource(this.testCaseId).subscribe({
      next: (source) => {
        this.paths.set(source.paths);
        if (type === 'gherkin') {
          this.gherkinForm.setValue({
            featureFile: source.featureFile ?? '',
            stepDefinitions: source.stepDefinitions ?? '',
            pageObject: source.pageObject ?? '',
          });
        } else {
          this.specForm.setValue({ specFile: source.specFile ?? '' });
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Could not load test source files.'));
        this.loading.set(false);
      },
    });
  }

  save() {
    this.saving.set(true);
    this.saveError.set(null);
    this.saveMessage.set(null);

    const type = this.testCase()?.type;
    const payload =
      type === 'gherkin'
        ? this.gherkinForm.getRawValue()
        : { specFile: this.specForm.getRawValue().specFile };

    this.testCasesService.updateSource(this.testCaseId, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveMessage.set('Saved. Run the suite to verify your changes.');
      },
      error: (err) => {
        this.saveError.set(apiErrorMessage(err, 'Failed to save test source.'));
        this.saving.set(false);
      },
    });
  }
}
