import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TestRunDetail } from '@playwright-platform/shared-types';
import { ProjectsService } from '../../core/services/projects.service';
import { TestRunsService } from '../../core/services/test-runs.service';

@Component({
  selector: 'app-run-detail',
  imports: [RouterLink],
  template: `
    @if (loading()) {
      <p class="empty">Loading…</p>
    } @else if (error()) {
      <p class="error">{{ error() }}</p>
    } @else if (run()) {
      <div class="page-header">
        <div>
          <div class="breadcrumb">
            <a routerLink="/projects">Projects</a> /
            <a [routerLink]="['/projects', projectId]">{{ projectName() }}</a> /
            Run
          </div>
          <h2>Test run</h2>
          <p class="empty">
            @if (run()!.suiteName) {
              Suite: {{ run()!.suiteName }}
            }
            @if (run()!.environmentName) {
              · Environment: {{ run()!.environmentName }}
            }
            @if (run()!.headed) {
              · <span class="mode-badge">Visible browser</span>
            }
          </p>
        </div>
        <span class="status-badge" [class]="'status-' + run()!.status">{{ run()!.status }}</span>
      </div>

      @if (run()!.status === 'failed' && failureSummary()) {
        <section class="card error-banner">
          <h3>Run failed</h3>
          <p>{{ failureSummary() }}</p>
          @if (run()!.headed) {
            <p class="hint">
              Visible browser mode was requested. If no window appeared, the run likely failed before Playwright launched.
            </p>
          }
        </section>
      }

      <section class="card">
        <h3>Results</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Test case</th>
              <th>Type</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Artifacts</th>
            </tr>
          </thead>
          <tbody>
            @for (result of run()!.testResults; track result.id) {
              <tr>
                <td>
                  <strong>{{ result.testCaseName }}</strong>
                  <div class="empty"><code>{{ result.testCaseFilePath }}</code></div>
                  @if (result.errorMessage) {
                    <div class="error">{{ result.errorMessage }}</div>
                  }
                </td>
                <td>{{ result.testCaseType }}</td>
                <td>
                  <span class="status-badge" [class]="'status-' + result.status">{{
                    result.status
                  }}</span>
                </td>
                <td>
                  @if (result.durationMs !== undefined) {
                    {{ result.durationMs }}ms
                  } @else {
                    —
                  }
                </td>
                <td>
                  <div class="artifact-list">
                    @for (artifact of result.artifactPaths; track artifact) {
                      @if (isImage(artifact)) {
                        <a
                          [href]="testRunsService.artifactUrl(run()!.id, artifact)"
                          target="_blank"
                          rel="noopener"
                          class="artifact-preview"
                        >
                          <img
                            [src]="testRunsService.artifactUrl(run()!.id, artifact)"
                            [alt]="artifactName(artifact)"
                          />
                          <span>{{ artifactName(artifact) }}</span>
                        </a>
                      } @else if (isVideo(artifact)) {
                        <div class="artifact-preview">
                          <video
                            controls
                            [src]="testRunsService.artifactUrl(run()!.id, artifact)"
                          ></video>
                          <a
                            [href]="testRunsService.artifactUrl(run()!.id, artifact)"
                            target="_blank"
                            rel="noopener"
                          >
                            {{ artifactName(artifact) }}
                          </a>
                        </div>
                      } @else {
                        <a
                          class="artifact-link"
                          [href]="testRunsService.artifactUrl(run()!.id, artifact)"
                          target="_blank"
                          rel="noopener"
                        >
                          {{ artifactName(artifact) }}
                        </a>
                      }
                    }
                  </div>
                  @if (result.artifactPaths.length === 0) {
                    <span class="empty">—</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </section>

      <section class="card">
        <h3>Log</h3>
        @if (log()) {
          <pre class="log-output">{{ log() }}</pre>
        } @else {
          <p class="empty">Log not available yet.</p>
        }
      </section>
    }
  `,
  styles: `
    code {
      font-size: 0.8125rem;
    }

    .status-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .mode-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: #eef2ff;
      color: #4f46e5;
      text-transform: none;
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

    .error-banner {
      border-color: #fecaca;
      background: #fef2f2;

      h3 {
        margin: 0 0 0.5rem;
        color: #b91c1c;
      }

      p {
        margin: 0;
        color: #7f1d1d;
      }

      .hint {
        margin-top: 0.75rem;
        font-size: 0.8125rem;
        color: #991b1b;
      }
    }

    .log-output {
      margin: 0;
      padding: 1rem;
      background: #1a1a2e;
      color: #e0e0e0;
      border-radius: 4px;
      font-size: 0.75rem;
      overflow-x: auto;
      max-height: 24rem;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .artifact-link {
      display: block;
      font-size: 0.8125rem;
      color: #3d5afe;
      text-decoration: none;
      margin-bottom: 0.25rem;

      &:hover {
        text-decoration: underline;
      }
    }

    .artifact-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .artifact-preview {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      img {
        max-width: 12rem;
        max-height: 8rem;
        border-radius: 4px;
        border: 1px solid #ddd;
      }

      video {
        max-width: 16rem;
        max-height: 10rem;
        border-radius: 4px;
        border: 1px solid #ddd;
      }

      span,
      a {
        font-size: 0.75rem;
        color: #3d5afe;
      }
    }
  `,
})
export class RunDetailComponent implements OnInit, OnDestroy {
  readonly testRunsService = inject(TestRunsService);
  private readonly route = inject(ActivatedRoute);
  private readonly projectsService = inject(ProjectsService);

  projectId = '';
  runId = '';
  readonly projectName = signal('');
  readonly run = signal<TestRunDetail | null>(null);
  readonly log = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
    this.runId = this.route.snapshot.paramMap.get('runId') ?? '';
    this.projectsService.get(this.projectId).subscribe({
      next: (p) => this.projectName.set(p.name),
      error: () => this.projectName.set('Project'),
    });
    this.refresh();
    this.pollTimer = setInterval(() => this.refresh(false), 2000);
  }

  ngOnDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  refresh(showLoading = true) {
    if (showLoading) this.loading.set(true);
    this.testRunsService.get(this.runId).subscribe({
      next: (run) => {
        this.run.set(run);
        this.loading.set(false);
        if (run.status === 'passed' || run.status === 'failed' || run.status === 'cancelled') {
          if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
          }
        }
      },
      error: () => {
        this.error.set('Test run not found.');
        this.loading.set(false);
      },
    });

    this.testRunsService.getLog(this.runId).subscribe({
      next: (log) => this.log.set(log),
      error: () => undefined,
    });
  }

  artifactName(path: string): string {
    return path.split('/').pop() ?? path;
  }

  isImage(path: string): boolean {
    return /\.(png|jpg|jpeg|webp)$/i.test(path);
  }

  isVideo(path: string): boolean {
    return /\.webm$/i.test(path);
  }

  failureSummary(): string | null {
    const run = this.run();
    if (!run) return null;
    const failed = run.testResults.filter((result) => result.status === 'failed');
    if (failed.length === 0) return null;
    return failed.map((result) => result.errorMessage ?? result.testCaseName).join(' · ');
  }
}
