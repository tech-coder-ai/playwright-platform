import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectSummary } from '@playwright-platform/shared-types';
import { ProjectsService } from '../../core/services/projects.service';

@Component({
  selector: 'app-projects-list',
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <div class="page-header">
      <h2>Projects</h2>
    </div>

    <section class="card">
      <h3>New project</h3>
      <form class="form" [formGroup]="form" (ngSubmit)="create()">
        <label>
          Name
          <input formControlName="name" placeholder="My App" />
        </label>
        <label>
          Description
          <textarea formControlName="description" placeholder="Optional"></textarea>
        </label>
        @if (formError()) {
          <p class="error">{{ formError() }}</p>
        }
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" [disabled]="form.invalid || saving()">
            Create project
          </button>
        </div>
      </form>
    </section>

    <section class="card">
      <h3>All projects</h3>
      @if (loading()) {
        <p class="empty">Loading…</p>
      } @else if (error()) {
        <p class="error">{{ error() }}</p>
      } @else if (projects().length === 0) {
        <p class="empty">No projects yet. Create one above.</p>
      } @else {
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Environments</th>
              <th>Suites</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (project of projects(); track project.id) {
              <tr>
                <td>
                  <a [routerLink]="['/projects', project.id]">{{ project.name }}</a>
                  @if (project.description) {
                    <div class="empty">{{ project.description }}</div>
                  }
                </td>
                <td>{{ project.environmentCount }}</td>
                <td>{{ project.testSuiteCount }}</td>
                <td class="actions-cell">
                  <button class="btn btn-danger" type="button" (click)="remove(project)">
                    Delete
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
})
export class ProjectsListComponent implements OnInit {
  private readonly projectsService = inject(ProjectsService);
  private readonly fb = inject(FormBuilder);

  readonly projects = signal<ProjectSummary[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.projectsService.list().subscribe({
      next: (data) => {
        this.projects.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not reach the API. Is the backend running on port 3000?');
        this.loading.set(false);
      },
    });
  }

  create() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.formError.set(null);
    const { name, description } = this.form.getRawValue();
    this.projectsService
      .create({ name, description: description || undefined })
      .subscribe({
        next: () => {
          this.form.reset({ name: '', description: '' });
          this.saving.set(false);
          this.load();
        },
        error: () => {
          this.formError.set('Failed to create project.');
          this.saving.set(false);
        },
      });
  }

  remove(project: ProjectSummary) {
    if (!confirm(`Delete project "${project.name}"? This removes all related data.`)) return;
    this.projectsService.delete(project.id).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Failed to delete project.'),
    });
  }
}
