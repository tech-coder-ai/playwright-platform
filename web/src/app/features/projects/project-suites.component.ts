import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TestSuiteSummary } from '@playwright-platform/shared-types';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { ProjectsService } from '../../core/services/projects.service';
import { parseTagsInput } from '../../shared/utils/tags.util';

@Component({
  selector: 'app-project-suites',
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <section class="card">
      <div class="panel-header">
        <div>
          <h3>Test suites</h3>
          <p class="panel-desc">Group recorded tests for execution and scheduling.</p>
        </div>
        <button class="btn btn-primary" type="button" (click)="toggleCreate()">
          {{ showCreate() ? 'Cancel' : 'New suite' }}
        </button>
      </div>

      @if (showCreate()) {
        <div class="create-panel">
          <form class="form" [formGroup]="form" (ngSubmit)="create()">
            <div class="form-grid">
              <label>
                Name
                <input formControlName="name" placeholder="Smoke tests" />
              </label>
              <label>
                Tags
                <input formControlName="tags" placeholder="smoke, regression" />
              </label>
            </div>
            <label>
              Description
              <textarea formControlName="description" placeholder="Optional description" rows="2"></textarea>
            </label>
            @if (error()) {
              <p class="error">{{ error() }}</p>
            }
            <div class="form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="form.invalid || saving()">
                Create suite
              </button>
            </div>
          </form>
        </div>
      }

      @if (suites().length === 0 && !showCreate()) {
        <div class="empty-panel">
          <p>No test suites yet.</p>
          <button class="btn btn-primary" type="button" (click)="toggleCreate()">Create your first suite</button>
        </div>
      } @else if (suites().length > 0) {
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Tags</th>
              <th>Test cases</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (suite of suites(); track suite.id) {
              <tr>
                <td>
                  <a [routerLink]="['/projects', projectId, 'suites', suite.id]" class="suite-link">{{
                    suite.name
                  }}</a>
                  @if (suite.description) {
                    <div class="row-desc">{{ suite.description }}</div>
                  }
                </td>
                <td>
                  @for (tag of suite.tags; track tag) {
                    <span class="tag">{{ tag }}</span>
                  }
                  @if (suite.tags.length === 0) {
                    <span class="muted">—</span>
                  }
                </td>
                <td>{{ suite.testCaseCount }}</td>
                <td class="actions-cell">
                  <a [routerLink]="['/projects', projectId, 'suites', suite.id]" class="btn btn-link">Open</a>
                  <button class="btn btn-danger" type="button" (click)="remove(suite)">Delete</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1rem;

      h3 {
        margin: 0;
      }
    }

    .panel-desc {
      margin: 0.25rem 0 0;
      font-size: 0.8125rem;
      color: #64748b;
    }

    .create-panel {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.25rem;
      margin-bottom: 1.25rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .empty-panel {
      text-align: center;
      padding: 2.5rem 1rem;
      color: #64748b;

      p {
        margin: 0 0 1rem;
      }
    }

    .suite-link {
      font-weight: 600;
      color: #4f46e5;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    .row-desc {
      font-size: 0.8125rem;
      color: #64748b;
      margin-top: 0.125rem;
    }

    .muted {
      color: #94a3b8;
    }
  `,
})
export class ProjectSuitesComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly testSuitesService = inject(TestSuitesService);
  private readonly projectsService = inject(ProjectsService);
  private readonly fb = inject(FormBuilder);

  projectId = '';
  readonly suites = signal<TestSuiteSummary[]>([]);
  readonly showCreate = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    tags: [''],
  });

  ngOnInit() {
    this.projectId = this.route.parent?.snapshot.paramMap.get('projectId') ?? '';
    this.load();
  }

  load() {
    this.testSuitesService.listByProject(this.projectId).subscribe({
      next: (data) => this.suites.set(data),
    });
  }

  toggleCreate() {
    this.showCreate.update((v) => !v);
    this.error.set(null);
  }

  create() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    const { name, description, tags } = this.form.getRawValue();
    this.testSuitesService
      .create(this.projectId, {
        name,
        description: description || undefined,
        tags: parseTagsInput(tags),
      })
      .subscribe({
        next: () => {
          this.form.reset({ name: '', description: '', tags: '' });
          this.saving.set(false);
          this.showCreate.set(false);
          this.load();
          this.projectsService.get(this.projectId).subscribe();
        },
        error: () => {
          this.error.set('Failed to create suite.');
          this.saving.set(false);
        },
      });
  }

  remove(suite: TestSuiteSummary) {
    if (!confirm(`Delete suite "${suite.name}" and all its test cases?`)) return;
    this.testSuitesService.delete(suite.id).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Failed to delete suite.'),
    });
  }
}
