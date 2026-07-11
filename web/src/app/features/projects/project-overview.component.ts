import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ProjectSummary, Schedule, TestRunSummary, TestSuiteSummary } from '@playwright-platform/shared-types';
import { ProjectsService } from '../../core/services/projects.service';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { SchedulesService } from '../../core/services/schedules.service';
import { TestRunsService } from '../../core/services/test-runs.service';

@Component({
  selector: 'app-project-overview',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="metrics-row">
      <div class="metric-card">
        <span class="metric-label">Test suites</span>
        <span class="metric-value">{{ suites().length }}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Environments</span>
        <span class="metric-value">{{ project()?.environmentCount ?? 0 }}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Active schedules</span>
        <span class="metric-value">{{ activeSchedules() }}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Recent runs</span>
        <span class="metric-value">{{ recentRuns().length }}</span>
      </div>
    </div>

    <div class="panel-grid">
      <section class="card">
        <div class="panel-header">
          <div>
            <h3>Get started</h3>
            <p class="panel-desc">Recommended workflow for this project</p>
          </div>
        </div>
        <ol class="workflow-steps">
          <li>
            <strong>Configure targets</strong>
            <span>Add environments and secrets under Configuration.</span>
            <a [routerLink]="['/projects', projectId, 'settings']">Open configuration →</a>
          </li>
          <li>
            <strong>Create a suite</strong>
            <span>Organize tests into runnable groups.</span>
            <a [routerLink]="['/projects', projectId, 'suites']">Manage suites →</a>
          </li>
          <li>
            <strong>Record tests</strong>
            <span>Capture flows and generate Gherkin from recordings.</span>
            <a [routerLink]="['/projects', projectId, 'recorder']">Open recorder →</a>
          </li>
          <li>
            <strong>Schedule runs</strong>
            <span>Automate suite execution on a cron.</span>
            <a [routerLink]="['/projects', projectId, 'schedules']">View schedules →</a>
          </li>
        </ol>
      </section>

      <section class="card">
        <div class="panel-header">
          <h3>Recent runs</h3>
        </div>
        @if (recentRuns().length === 0) {
          <p class="empty">No runs yet. Open a suite and click Run suite.</p>
        } @else {
          <table class="table compact">
            <thead>
              <tr>
                <th>Suite</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              @for (run of recentRuns(); track run.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/projects', projectId, 'runs', run.id]">
                      {{ run.suiteName ?? 'Run' }}
                    </a>
                  </td>
                  <td>
                    <span class="status-badge" [class]="'status-' + run.status">{{ run.status }}</span>
                  </td>
                  <td>{{ run.createdAt | date: 'short' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>
    </div>

    @if (suites().length > 0) {
      <section class="card">
        <div class="panel-header">
          <h3>Test suites</h3>
          <a [routerLink]="['/projects', projectId, 'suites']" class="btn btn-link">View all</a>
        </div>
        <table class="table compact">
          <thead>
            <tr>
              <th>Name</th>
              <th>Cases</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (suite of suites().slice(0, 5); track suite.id) {
              <tr>
                <td>{{ suite.name }}</td>
                <td>{{ suite.testCaseCount }}</td>
                <td>
                  <a [routerLink]="['/projects', projectId, 'suites', suite.id]">Open →</a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    }
  `,
  styles: `
    .metrics-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .metric-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem 1.125rem;
    }

    .metric-label {
      display: block;
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.25rem;
    }

    .metric-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
    }

    .panel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
      gap: 1.25rem;
      margin-bottom: 1.25rem;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;

      h3 {
        margin: 0;
      }
    }

    .panel-desc {
      margin: 0.25rem 0 0;
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .workflow-steps {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 1rem;

      li {
        display: grid;
        gap: 0.125rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--divider);

        &:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        strong {
          font-size: 0.875rem;
        }

        span {
          font-size: 0.8125rem;
          color: var(--text-muted);
        }

        a {
          font-size: 0.8125rem;
          color: var(--accent);
          text-decoration: none;
          margin-top: 0.125rem;

          &:hover {
            text-decoration: underline;
          }
        }
      }
    }

    .table.compact th,
    .table.compact td {
      padding: 0.5rem 0.75rem;
    }
  `,
})
export class ProjectOverviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly projectsService = inject(ProjectsService);
  private readonly testSuitesService = inject(TestSuitesService);
  private readonly schedulesService = inject(SchedulesService);
  private readonly testRunsService = inject(TestRunsService);

  projectId = '';
  readonly project = signal<ProjectSummary | null>(null);
  readonly suites = signal<TestSuiteSummary[]>([]);
  readonly schedules = signal<Schedule[]>([]);
  readonly recentRuns = signal<TestRunSummary[]>([]);

  activeSchedules = () => this.schedules().filter((s) => s.enabled).length;

  ngOnInit() {
    this.projectId = this.route.parent?.snapshot.paramMap.get('projectId') ?? '';
    this.projectsService.get(this.projectId).subscribe({
      next: (project) => this.project.set(project),
    });
    this.testSuitesService.listByProject(this.projectId).subscribe({
      next: (data) => this.suites.set(data),
    });
    this.schedulesService.listByProject(this.projectId).subscribe({
      next: (data) => this.schedules.set(data),
    });
    this.testRunsService.listByProject(this.projectId).subscribe({
      next: (runs) => this.recentRuns.set(runs.slice(0, 5)),
    });
  }
}
