import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ProjectSummary } from '@playwright-platform/shared-types';
import { ProjectsService } from '../../core/services/projects.service';

interface ProjectTab {
  label: string;
  path: string;
  exact?: boolean;
}

@Component({
  selector: 'app-project-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (loading()) {
      <p class="empty">Loading project…</p>
    } @else if (error()) {
      <p class="error">{{ error() }}</p>
    } @else if (project()) {
      <header class="project-header">
        <div class="project-identity">
          <div class="breadcrumb">
            <a routerLink="/projects">Projects</a>
            <span>/</span>
            <span>{{ project()!.name }}</span>
          </div>
          <h2>{{ project()!.name }}</h2>
          @if (project()!.description) {
            <p class="project-desc">{{ project()!.description }}</p>
          }
        </div>
        <div class="header-actions">
          <a [routerLink]="['/projects', projectId, 'recorder']" class="btn btn-primary">
            Record test
          </a>
          <a [routerLink]="['/projects', projectId, 'page-objects']" class="btn btn-secondary">
            Page objects
          </a>
        </div>
      </header>

      <nav class="project-nav" aria-label="Project sections">
        @for (tab of tabs; track tab.path) {
          <a
            [routerLink]="tab.path === '' ? ['/projects', projectId] : ['/projects', projectId, tab.path]"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: tab.exact ?? false }"
          >
            {{ tab.label }}
          </a>
        }
      </nav>

      <div class="project-content">
        <router-outlet />
      </div>
    }
  `,
  styles: `
    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: #64748b;
      margin-bottom: 0.375rem;

      a {
        color: #4f46e5;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .project-identity h2 {
      margin: 0;
    }

    .project-desc {
      margin: 0.375rem 0 0;
      color: #64748b;
      font-size: 0.875rem;
      max-width: 40rem;
    }

    .header-actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .project-nav {
      display: flex;
      gap: 0.25rem;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 1.5rem;
      overflow-x: auto;

      a {
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #64748b;
        text-decoration: none;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        white-space: nowrap;

        &:hover {
          color: #334155;
        }

        &.active {
          color: #4f46e5;
          border-bottom-color: #4f46e5;
        }
      }
    }

    .project-content {
      min-height: 12rem;
    }
  `,
})
export class ProjectShellComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly projectsService = inject(ProjectsService);

  projectId = '';
  readonly project = signal<ProjectSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly tabs: ProjectTab[] = [
    { label: 'Overview', path: '', exact: true },
    { label: 'Test suites', path: 'suites' },
    { label: 'Schedules', path: 'schedules' },
    { label: 'Configuration', path: 'settings' },
  ];

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
    this.projectsService.get(this.projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Project not found.');
        this.loading.set(false);
      },
    });
  }
}
