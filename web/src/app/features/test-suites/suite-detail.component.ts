import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Environment,
  TestCase,
  TestCaseType,
  TestRunSummary,
  TestSuiteSummary,
} from '@playwright-platform/shared-types';
import { ProjectsService } from '../../core/services/projects.service';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { TestCasesService } from '../../core/services/test-cases.service';
import { EnvironmentsService } from '../../core/services/environments.service';
import { TestRunsService } from '../../core/services/test-runs.service';
import { formatTags, parseTagsInput } from '../../shared/utils/tags.util';
import { apiErrorMessage } from '../../shared/utils/api-error.util';

@Component({
  selector: 'app-suite-detail',
  imports: [RouterLink, ReactiveFormsModule, DatePipe],
  template: `
    @if (loading()) {
      <p class="empty">Loading…</p>
    } @else if (error()) {
      <p class="error">{{ error() }}</p>
    } @else if (suite()) {
      <div class="page-header">
        <div>
          <div class="breadcrumb">
            <a routerLink="/projects">Projects</a> /
            <a [routerLink]="['/projects', projectId]">{{ projectName() }}</a> /
            {{ suite()!.name }}
          </div>
          <h2>{{ suite()!.name }}</h2>
          @if (suite()!.description) {
            <p class="empty">{{ suite()!.description }}</p>
          }
          @if (suite()!.tags.length) {
            <p>
              @for (tag of suite()!.tags; track tag) {
                <span class="tag">{{ tag }}</span>
              }
            </p>
          }
        </div>
      </div>

      <section class="card">
        <h3>Run suite</h3>
        <p class="empty">
          Runs all recorded test cases in this suite via Cucumber (Gherkin) or Playwright.
        </p>
        <form class="run-form" [formGroup]="runForm" (ngSubmit)="triggerRun()">
          <div class="run-options">
            <label>
              Environment
              <select formControlName="environmentId">
                <option value="">Default (example.com)</option>
                @for (env of environments(); track env.id) {
                  <option [value]="env.id">{{ env.name }} — {{ env.baseUrl }}</option>
                }
              </select>
            </label>
            <label class="checkbox-row headed-toggle">
              <input type="checkbox" formControlName="headed" />
              <span>
                <strong>Watch in browser</strong>
                <span class="hint">Opens a visible Chromium window on the machine running the API (local dev only).</span>
              </span>
            </label>
          </div>
          <div class="run-actions">
            <button
              class="btn btn-primary"
              type="submit"
              [disabled]="runForm.invalid || running() || testCases().length === 0"
            >
              {{ running() ? 'Starting…' : (runForm.value.headed ? 'Run suite (visible)' : 'Run suite') }}
            </button>
          </div>
        </form>
        @if (runError()) {
          <p class="error">{{ runError() }}</p>
        }

        @if (recentRuns().length > 0) {
          <table class="table" style="margin-top: 1rem">
            <thead>
              <tr>
                <th>Started</th>
                <th>Environment</th>
                <th>Mode</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (run of recentRuns(); track run.id) {
                <tr>
                  <td>{{ run.createdAt | date: 'medium' }}</td>
                  <td>{{ run.environmentName ?? 'Default' }}</td>
                  <td>{{ run.headed ? 'Visible' : 'Headless' }}</td>
                  <td>
                    <span class="status-badge" [class]="'status-' + run.status">{{
                      run.status
                    }}</span>
                  </td>
                  <td>
                    <a [routerLink]="['/projects', projectId, 'runs', run.id]">View</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>

      <section class="card">
        <h3>Test cases ({{ testCases().length }})</h3>
        @if (testCases().length === 0) {
          <div class="empty-state-inline">
            <p>No tests in this suite yet.</p>
            <p class="empty">
              Tests are created by recording browser actions — not by typing file paths manually.
              Page objects are managed separately and can be referenced from generated step definitions.
            </p>
            <a
              [routerLink]="['/projects', projectId, 'recorder']"
              [queryParams]="{ suiteId: suiteId }"
              class="btn btn-primary"
            >
              Record first test
            </a>
          </div>
        } @else {
          <div class="suite-actions">
            <a
              [routerLink]="['/projects', projectId, 'recorder']"
              [queryParams]="{ suiteId: suiteId }"
              class="btn btn-secondary"
            >
              Record another test
            </a>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>File</th>
                <th>Tags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (testCase of testCases(); track testCase.id) {
                <tr>
                  @if (editingId() === testCase.id) {
                    <td colspan="5">
                      <form
                        class="inline-form"
                        [formGroup]="editForm"
                        (ngSubmit)="save(testCase.id)"
                      >
                        <label>
                          Name
                          <input formControlName="name" />
                        </label>
                        <label>
                          Type
                          <select formControlName="type">
                            <option value="gherkin">Gherkin</option>
                            <option value="playwright-native">Playwright native</option>
                          </select>
                        </label>
                        <label>
                          File
                          <input formControlName="filePath" />
                        </label>
                        <label>
                          Tags
                          <input formControlName="tags" />
                        </label>
                        <button class="btn btn-primary" type="submit">Save</button>
                        <button class="btn btn-secondary" type="button" (click)="cancelEdit()">
                          Cancel
                        </button>
                      </form>
                    </td>
                  } @else {
                    <td>{{ testCase.name }}</td>
                    <td>{{ testCase.type }}</td>
                    <td><code>{{ testCase.filePath }}</code></td>
                    <td>
                      @for (tag of testCase.tags; track tag) {
                        <span class="tag">{{ tag }}</span>
                      }
                    </td>
                    <td class="actions-cell">
                      <a
                        class="btn btn-link"
                        [routerLink]="[
                          '/projects',
                          projectId,
                          'suites',
                          suiteId,
                          'tests',
                          testCase.id,
                          'edit',
                        ]"
                      >
                        Edit source
                      </a>
                      <button class="btn btn-link" type="button" (click)="startEdit(testCase)">
                        Edit
                      </button>
                      <button class="btn btn-danger" type="button" (click)="remove(testCase)">
                        Delete
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        }
      </section>
    }
  `,
  styles: `
    code {
      font-size: 0.8125rem;
    }

    .empty-state-inline {
      padding: 0.5rem 0 0.25rem;

      p:first-child {
        margin: 0 0 0.375rem;
        font-weight: 500;
      }
    }

    .suite-actions {
      margin-bottom: 1rem;
    }

    .run-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .run-options {
      display: grid;
      gap: 1rem;
    }

    .headed-toggle {
      align-items: flex-start;
      max-width: 28rem;

      strong {
        display: block;
        font-size: 0.875rem;
      }

      .hint {
        display: block;
        margin-top: 0.125rem;
        font-size: 0.8125rem;
        color: #64748b;
        font-weight: 400;
      }
    }

    .run-actions {
      display: flex;
      gap: 0.5rem;
    }

    .status-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-pending,
    .status-running {
      background: #fff3e0;
      color: #e65100;
    }

    .status-passed {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .status-failed {
      background: #ffebee;
      color: #c62828;
    }

    .status-skipped {
      background: #eceff1;
      color: #546e7a;
    }
  `,
})
export class SuiteDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectsService = inject(ProjectsService);
  private readonly testSuitesService = inject(TestSuitesService);
  private readonly testCasesService = inject(TestCasesService);
  private readonly environmentsService = inject(EnvironmentsService);
  private readonly testRunsService = inject(TestRunsService);
  private readonly fb = inject(FormBuilder);

  projectId = '';
  suiteId = '';
  readonly projectName = signal('');
  readonly suite = signal<TestSuiteSummary | null>(null);
  readonly testCases = signal<TestCase[]>([]);
  readonly environments = signal<Environment[]>([]);
  readonly recentRuns = signal<TestRunSummary[]>([]);
  readonly loading = signal(true);
  readonly running = signal(false);
  readonly error = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly runError = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly runForm = this.fb.nonNullable.group({
    environmentId: [''],
    headed: [false],
  });

  readonly editForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    type: ['gherkin' as TestCaseType, Validators.required],
    filePath: ['', Validators.required],
    tags: [''],
  });

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
    this.suiteId = this.route.snapshot.paramMap.get('suiteId') ?? '';
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);

    this.projectsService.get(this.projectId).subscribe({
      next: (project) => this.projectName.set(project.name),
      error: () => this.projectName.set('Project'),
    });

    this.environmentsService.listByProject(this.projectId).subscribe({
      next: (data) => this.environments.set(data),
    });

    this.loadRecentRuns();

    this.testSuitesService.get(this.suiteId).subscribe({
      next: (suite) => {
        this.suite.set(suite);
        this.loading.set(false);
        this.loadTestCases();
      },
      error: () => {
        this.error.set('Test suite not found.');
        this.loading.set(false);
      },
    });
  }

  loadTestCases() {
    this.testCasesService.listBySuite(this.suiteId).subscribe({
      next: (data) => this.testCases.set(data),
    });
  }

  loadRecentRuns() {
    this.testRunsService.listByProject(this.projectId).subscribe({
      next: (runs) => {
        const filtered = runs.filter((run) => run.suiteId === this.suiteId).slice(0, 5);
        this.recentRuns.set(filtered);
      },
    });
  }

  triggerRun() {
    this.running.set(true);
    this.runError.set(null);
    const { environmentId, headed } = this.runForm.getRawValue();
    this.testRunsService
      .triggerSuiteRun(this.suiteId, {
        environmentId: environmentId || undefined,
        headed,
      })
      .subscribe({
        next: (run) => {
          this.running.set(false);
          this.loadRecentRuns();
          void this.router.navigate(['/projects', this.projectId, 'runs', run.id]);
        },
        error: (err) => {
          this.runError.set(apiErrorMessage(err, 'Failed to start test run.'));
          this.running.set(false);
        },
      });
  }

  startEdit(testCase: TestCase) {
    this.editingId.set(testCase.id);
    this.editForm.setValue({
      name: testCase.name,
      type: testCase.type,
      filePath: testCase.filePath,
      tags: formatTags(testCase.tags),
    });
  }

  cancelEdit() {
    this.editingId.set(null);
  }

  save(id: string) {
    if (this.editForm.invalid) return;
    const { name, type, filePath, tags } = this.editForm.getRawValue();
    this.testCasesService
      .update(id, { name, type, filePath, tags: parseTagsInput(tags) })
      .subscribe({
        next: () => {
          this.editingId.set(null);
          this.loadTestCases();
        },
        error: () => this.formError.set('Failed to update test case.'),
      });
  }

  remove(testCase: TestCase) {
    if (!confirm(`Delete test case "${testCase.name}"?`)) return;
    this.testCasesService.delete(testCase.id).subscribe({
      next: () => {
        this.loadTestCases();
        this.refreshSuiteCount();
      },
      error: () => this.formError.set('Failed to delete test case.'),
    });
  }

  private refreshSuiteCount() {
    this.testSuitesService.get(this.suiteId).subscribe({
      next: (suite) => this.suite.set(suite),
    });
  }
}
