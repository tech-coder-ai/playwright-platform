import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ChartConfiguration } from 'chart.js/auto';
import { DashboardData, ProjectSummary } from '@playwright-platform/shared-types';
import { DashboardService } from '../../core/services/dashboard.service';
import { ProjectsService } from '../../core/services/projects.service';
import { TestRunsService } from '../../core/services/test-runs.service';
import { ChartPanelComponent } from '../../shared/components/chart-panel.component';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, ReactiveFormsModule, DatePipe, ChartPanelComponent],
  template: `
    <div class="page-header">
      <div>
        <h2>Dashboard</h2>
        <p class="page-subtitle">Test run health across your projects</p>
      </div>
      <form class="filter-form" [formGroup]="filterForm">
        <label>
          Project
          <select formControlName="projectId" (change)="reload()">
            <option value="">All projects</option>
            @for (project of projects(); track project.id) {
              <option [value]="project.id">{{ project.name }}</option>
            }
          </select>
        </label>
      </form>
    </div>

    @if (loading()) {
      <p class="empty">Loading metrics…</p>
    } @else if (error()) {
      <div class="card empty-state">
        <p class="error">{{ error() }}</p>
      </div>
    } @else if (data()) {
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Total runs</span>
          <span class="stat-value">{{ data()!.summary.totalRuns }}</span>
        </div>
        <div class="stat-card stat-pass">
          <span class="stat-label">Passed</span>
          <span class="stat-value">{{ data()!.summary.passedRuns }}</span>
        </div>
        <div class="stat-card stat-fail">
          <span class="stat-label">Failed</span>
          <span class="stat-value">{{ data()!.summary.failedRuns }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Pass rate</span>
          <span class="stat-value">{{ data()!.summary.passRate }}%</span>
        </div>
      </div>

      @if (data()!.summary.totalRuns === 0) {
        <div class="card empty-state">
          <h3>No test runs yet</h3>
          <p>Record a test from a project, add it to a suite, then run the suite to see trends here.</p>
          <a routerLink="/projects" class="btn btn-primary">Go to projects</a>
        </div>
      }

      <div class="charts-grid">
        <section class="card">
          <h3>Daily pass / fail</h3>
          <p class="section-hint">Last 14 days of completed suite runs</p>
          <app-chart-panel
            [config]="dailyChartConfig()"
            [isEmpty]="data()!.summary.totalRuns === 0"
            emptyMessage="Run a test suite to populate this chart."
          />
        </section>

        <section class="card outcomes-card">
          <h3>Recent run outcomes</h3>
          <p class="section-hint">Passed vs failed test cases per run</p>
          @if (data()!.runTrend.length === 0) {
            <p class="empty">No completed runs in the selected window.</p>
          } @else {
            <app-chart-panel [config]="runChartConfig()" height="10rem" />
            <ul class="run-timeline">
              @for (run of data()!.runTrend.slice().reverse(); track run.runId) {
                <li>
                  <span class="status-dot" [class]="'dot-' + run.status"></span>
                  <div>
                    <a [routerLink]="['/projects', run.projectId, 'runs', run.runId]">
                      {{ run.suiteName ?? 'Suite run' }}
                    </a>
                    <span class="run-meta">
                      {{ run.projectName }} · {{ run.createdAt | date: 'medium' }} ·
                      {{ run.passedCount }} passed, {{ run.failedCount }} failed
                    </span>
                  </div>
                </li>
              }
            </ul>
          }
        </section>
      </div>

      <section class="card">
        <h3>Suite health</h3>
        @if (data()!.suiteHealth.length === 0) {
          <p class="empty">No test suites yet.</p>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Suite</th>
                <th>Pass rate</th>
                <th>Runs</th>
                <th>Last run</th>
              </tr>
            </thead>
            <tbody>
              @for (row of data()!.suiteHealth; track row.suiteId) {
                <tr>
                  <td>{{ row.projectName }}</td>
                  <td>
                    <a [routerLink]="['/projects', row.projectId, 'suites', row.suiteId]">{{
                      row.suiteName
                    }}</a>
                  </td>
                  <td>
                    <span class="pass-rate" [class.low]="row.passRate < 80">{{
                      row.passRate
                    }}%</span>
                  </td>
                  <td>{{ row.totalRuns }}</td>
                  <td>
                    @if (row.lastRunStatus) {
                      <span class="status-badge" [class]="'status-' + row.lastRunStatus">{{
                        row.lastRunStatus
                      }}</span>
                      @if (row.lastRunAt) {
                        <span class="muted"> · {{ row.lastRunAt | date: 'short' }}</span>
                      }
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>

      <div class="two-col">
        <section class="card">
          <h3>Flaky tests</h3>
          <p class="section-hint">Mixed pass/fail with status flips (last 30 runs)</p>
          @if (data()!.flakyTests.length === 0) {
            <p class="empty">No flaky tests detected.</p>
          } @else {
            <table class="table">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Score</th>
                  <th>Flips</th>
                  <th>Fail rate</th>
                </tr>
              </thead>
              <tbody>
                @for (test of data()!.flakyTests; track test.testCaseId) {
                  <tr>
                    <td>
                      <strong>{{ test.testCaseName }}</strong>
                      <div class="muted">{{ test.projectName }} / {{ test.suiteName }}</div>
                    </td>
                    <td>{{ test.flakyScore }}%</td>
                    <td>{{ test.statusFlips }}</td>
                    <td>{{ test.failureRate }}%</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>

        <section class="card">
          <h3>Recent failures</h3>
          @if (data()!.recentFailures.length === 0) {
            <p class="empty">No failures recorded.</p>
          } @else {
            <ul class="failure-list">
              @for (failure of data()!.recentFailures; track failure.runId + failure.testCaseId) {
                <li>
                  <a [routerLink]="['/projects', failure.projectId, 'runs', failure.runId]">
                    <strong>{{ failure.testCaseName }}</strong>
                  </a>
                  <div class="muted">
                    {{ failure.projectName }}
                    @if (failure.suiteName) {
                      / {{ failure.suiteName }}
                    }
                    · {{ failure.failedAt | date: 'short' }}
                  </div>
                  @if (failure.errorMessage) {
                    <div class="error-msg">{{ failure.errorMessage }}</div>
                  }
                </li>
              }
            </ul>
          }
        </section>
      </div>
    }
  `,
  styles: `
    .page-subtitle {
      margin: 0.25rem 0 0;
      color: #64748b;
      font-size: 0.875rem;
    }

    .section-hint {
      margin: -0.25rem 0 0.75rem;
      color: #64748b;
      font-size: 0.8125rem;
    }

    .filter-form label {
      display: grid;
      gap: 0.25rem;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .filter-form select {
      padding: 0.5rem 0.625rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font: inherit;
      min-width: 12rem;
      background: #fff;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .stat-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
    }

    .stat-label {
      font-size: 0.8125rem;
      color: #64748b;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: #0f172a;
    }

    .stat-pass .stat-value {
      color: #15803d;
    }

    .stat-fail .stat-value {
      color: #b91c1c;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
      gap: 1.25rem;
      margin-bottom: 1.25rem;
      align-items: start;
    }

    .outcomes-card {
      max-height: 22rem;
      display: flex;
      flex-direction: column;
      margin-bottom: 0;
      overflow: hidden;
    }

    .outcomes-card .section-hint {
      flex-shrink: 0;
    }

    .two-col {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
      gap: 1.25rem;
    }

    .empty-state {
      text-align: center;
      padding: 2rem;

      h3 {
        margin: 0 0 0.5rem;
      }

      p {
        color: #64748b;
        margin: 0 0 1rem;
      }
    }

    .run-timeline {
      list-style: none;
      padding: 0;
      margin: 0.75rem 0 0;
      border-top: 1px solid #e2e8f0;
      max-height: 8.5rem;
      overflow-y: auto;
      flex: 1;
      min-height: 0;

      li {
        display: flex;
        gap: 0.75rem;
        padding: 0.625rem 0;
        border-bottom: 1px solid #f1f5f9;
      }
    }

    .status-dot {
      width: 0.625rem;
      height: 0.625rem;
      border-radius: 50%;
      margin-top: 0.375rem;
      flex-shrink: 0;
    }

    .dot-passed {
      background: #22c55e;
    }

    .dot-failed {
      background: #ef4444;
    }

    .run-meta {
      display: block;
      font-size: 0.8125rem;
      color: #64748b;
      margin-top: 0.125rem;
    }

    .muted {
      color: #64748b;
      font-size: 0.8125rem;
    }

    .pass-rate.low {
      color: #b91c1c;
      font-weight: 600;
    }

    .failure-list {
      list-style: none;
      padding: 0;
      margin: 0;

      li {
        padding: 0.75rem 0;
        border-bottom: 1px solid #f1f5f9;
      }
    }

    .error-msg {
      font-size: 0.8125rem;
      color: #b91c1c;
      margin-top: 0.25rem;
    }
  `,
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly projectsService = inject(ProjectsService);
  private readonly testRunsService = inject(TestRunsService);
  private readonly fb = inject(FormBuilder);

  readonly projects = signal<ProjectSummary[]>([]);
  readonly data = signal<DashboardData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly filterForm = this.fb.nonNullable.group({ projectId: [''] });

  readonly dailyChartConfig = computed((): ChartConfiguration => {
    const trend = this.data()?.dailyTrend ?? [];
    return {
      type: 'bar',
      data: {
        labels: trend.map((p) => p.date.slice(5)),
        datasets: [
          {
            label: 'Passed',
            data: trend.map((p) => p.passed),
            backgroundColor: '#22c55e',
            borderRadius: 4,
          },
          {
            label: 'Failed',
            data: trend.map((p) => p.failed),
            backgroundColor: '#ef4444',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } },
        },
      },
    };
  });

  readonly runChartConfig = computed((): ChartConfiguration => {
    const runs = this.data()?.runTrend ?? [];
    return {
      type: 'bar',
      data: {
        labels: runs.map((r) => {
          const d = new Date(r.createdAt);
          return `${r.suiteName ?? 'Run'} ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
        }),
        datasets: [
          {
            label: 'Passed cases',
            data: runs.map((r) => r.passedCount),
            backgroundColor: '#22c55e',
            borderRadius: 4,
          },
          {
            label: 'Failed cases',
            data: runs.map((r) => r.failedCount),
            backgroundColor: '#ef4444',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } },
        },
      },
    };
  });

  ngOnInit() {
    this.projectsService.list().subscribe({
      next: (projects) => this.projects.set(projects),
    });
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.error.set(null);
    const projectId = this.filterForm.getRawValue().projectId || undefined;
    this.dashboardService.get(projectId).subscribe({
      next: (dashboard) => {
        this.data.set(dashboard);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load dashboard metrics.');
        this.loading.set(false);
      },
    });
  }

  artifactUrl(runId: string, path: string): string {
    return this.testRunsService.artifactUrl(runId, path);
  }
}
