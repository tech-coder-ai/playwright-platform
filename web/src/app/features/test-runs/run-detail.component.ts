import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TestResultDetail, TestRunDetail } from '@playwright-platform/shared-types';
import { ProjectsService } from '../../core/services/projects.service';
import { TestRunsService } from '../../core/services/test-runs.service';

type ViewerTab = 'steps' | 'log' | 'media';

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
          <p class="run-meta">
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
        </section>
      }

      <div class="run-viewer">
        <aside class="case-list">
          <h3>Test cases</h3>
          @for (result of run()!.testResults; track result.id) {
            <button
              type="button"
              class="case-item"
              [class.active]="selectedResultId() === result.id"
              (click)="selectResult(result)"
            >
              <span class="status-dot" [class]="'dot-' + result.status"></span>
              <span class="case-item-body">
                <strong>{{ result.testCaseName }}</strong>
                <span>{{ result.durationMs ?? '—' }}ms</span>
              </span>
            </button>
          }
        </aside>

        @if (selectedResult(); as result) {
          <section class="card case-panel">
            <div class="case-panel-header">
              <div>
                <h3>{{ result.testCaseName }}</h3>
                <code>{{ result.testCaseFilePath }}</code>
              </div>
              <span class="status-badge" [class]="'status-' + result.status">{{ result.status }}</span>
            </div>

            @if (result.errorMessage) {
              <p class="error case-error">{{ result.errorMessage }}</p>
            }

            <div class="viewer-tabs">
              @for (tab of viewerTabs; track tab.id) {
                <button
                  type="button"
                  class="viewer-tab"
                  [class.active]="viewerTab() === tab.id"
                  (click)="viewerTab.set(tab.id)"
                >
                  {{ tab.label }}
                  @if (tab.id === 'media' && mediaArtifacts(result).length > 0) {
                    <span class="tab-count">{{ mediaArtifacts(result).length }}</span>
                  }
                </button>
              }
            </div>

            @if (viewerTab() === 'steps') {
              @if (result.steps.length === 0) {
                <p class="empty">No step details yet. Run again after saving capture settings.</p>
              } @else {
                <ol class="step-list">
                  @for (step of result.steps; track step.order) {
                    <li [class]="'step-' + step.status">
                      <div class="step-header">
                        <span class="status-badge" [class]="'status-' + step.status">{{
                          step.status
                        }}</span>
                        @if (step.durationMs !== undefined) {
                          <span class="step-duration">{{ step.durationMs }}ms</span>
                        }
                      </div>
                      <p class="step-text">
                        @if (step.keyword) {
                          <span class="keyword">{{ step.keyword }}</span>
                        }
                        {{ step.name }}
                      </p>
                      @if (step.errorMessage) {
                        <pre class="step-error">{{ step.errorMessage }}</pre>
                      }
                    </li>
                  }
                </ol>
              }
            }

            @if (viewerTab() === 'log') {
              @if (caseLog()) {
                <pre class="log-output">{{ caseLog() }}</pre>
              } @else if (caseLogLoading()) {
                <p class="empty">Loading case log…</p>
              } @else {
                <p class="empty">Case log not available yet.</p>
              }
            }

            @if (viewerTab() === 'media') {
              @if (mediaArtifacts(result).length === 0) {
                <p class="empty">
                  No screenshots or video captured. Enable capture under Project → Configuration → Run capture.
                </p>
              } @else {
                <div class="media-grid">
                  @for (artifact of mediaArtifacts(result); track artifact) {
                    @if (isImage(artifact)) {
                      <figure class="media-card">
                        <a
                          [href]="testRunsService.artifactUrl(run()!.id, artifact)"
                          target="_blank"
                          rel="noopener"
                        >
                          <img
                            [src]="testRunsService.artifactUrl(run()!.id, artifact)"
                            [alt]="artifactName(artifact)"
                          />
                        </a>
                        <figcaption>{{ artifactName(artifact) }}</figcaption>
                      </figure>
                    } @else if (isVideo(artifact)) {
                      <figure class="media-card video-card">
                        <video
                          controls
                          [src]="testRunsService.artifactUrl(run()!.id, artifact)"
                        ></video>
                        <figcaption>
                          <a
                            [href]="testRunsService.artifactUrl(run()!.id, artifact)"
                            target="_blank"
                            rel="noopener"
                          >
                            {{ artifactName(artifact) }}
                          </a>
                        </figcaption>
                      </figure>
                    }
                  }
                </div>
              }
            }
          </section>
        }
      </div>

      <details class="card run-log-details">
        <summary>Full run log</summary>
        @if (runLog()) {
          <pre class="log-output">{{ runLog() }}</pre>
        } @else {
          <p class="empty">Run log not available yet.</p>
        }
      </details>
    }
  `,
  styles: `
    code {
      font-size: 0.8125rem;
      color: #64748b;
    }

    .run-meta {
      margin: 0.375rem 0 0;
      color: #64748b;
      font-size: 0.875rem;
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
    }

    .run-viewer {
      display: grid;
      grid-template-columns: 14rem 1fr;
      gap: 1rem;
      align-items: start;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    .case-list {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 0.75rem;

      h3 {
        margin: 0 0 0.75rem;
        font-size: 0.875rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
    }

    .case-item {
      display: flex;
      gap: 0.625rem;
      width: 100%;
      text-align: left;
      padding: 0.625rem;
      border: 1px solid transparent;
      border-radius: 8px;
      background: none;
      cursor: pointer;
      font: inherit;

      &:hover {
        background: #f8fafc;
      }

      &.active {
        background: #eef2ff;
        border-color: #c7d2fe;
      }
    }

    .case-item-body {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-width: 0;

      strong {
        font-size: 0.8125rem;
      }

      span {
        font-size: 0.75rem;
        color: #64748b;
      }
    }

    .status-dot {
      width: 0.5rem;
      height: 0.5rem;
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

    .dot-pending,
    .dot-running {
      background: #f59e0b;
    }

    .dot-skipped {
      background: #94a3b8;
    }

    .case-panel {
      margin-bottom: 0;
    }

    .case-panel-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 1rem;

      h3 {
        margin: 0 0 0.25rem;
      }
    }

    .case-error {
      margin: 0 0 1rem;
    }

    .viewer-tabs {
      display: flex;
      gap: 0.375rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0.5rem;
    }

    .viewer-tab {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 0.75rem;
      border: none;
      background: none;
      border-radius: 8px;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;

      &.active {
        background: #eef2ff;
        color: #4f46e5;
      }
    }

    .tab-count {
      background: #4f46e5;
      color: #fff;
      font-size: 0.6875rem;
      padding: 0.0625rem 0.375rem;
      border-radius: 999px;
    }

    .step-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.75rem;
    }

    .step-list li {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.75rem 1rem;
      background: #fafafa;
    }

    .step-failed {
      border-color: #fecaca;
      background: #fef2f2;
    }

    .step-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.375rem;
    }

    .step-duration {
      font-size: 0.75rem;
      color: #64748b;
    }

    .step-text {
      margin: 0;
      font-size: 0.875rem;
    }

    .keyword {
      font-weight: 600;
      color: #4f46e5;
    }

    .step-error {
      margin: 0.5rem 0 0;
      padding: 0.5rem;
      background: #fff;
      border-radius: 6px;
      font-size: 0.75rem;
      white-space: pre-wrap;
      color: #b91c1c;
    }

    .log-output {
      margin: 0;
      padding: 1rem;
      background: #1a1a2e;
      color: #e0e0e0;
      border-radius: 8px;
      font-size: 0.75rem;
      overflow-x: auto;
      max-height: 28rem;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .media-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: 1rem;
    }

    .media-card {
      margin: 0;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      background: #f8fafc;

      img,
      video {
        display: block;
        width: 100%;
        max-height: 12rem;
        object-fit: contain;
        background: #0f172a;
      }

      figcaption {
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
        color: #64748b;

        a {
          color: #4f46e5;
        }
      }
    }

    .video-card video {
      max-height: 16rem;
    }

    .run-log-details {
      margin-top: 1rem;

      summary {
        cursor: pointer;
        font-weight: 600;
        margin-bottom: 0.75rem;
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
  readonly runLog = signal<string | null>(null);
  readonly caseLog = signal<string | null>(null);
  readonly caseLogLoading = signal(false);
  readonly selectedResultId = signal<string | null>(null);
  readonly viewerTab = signal<ViewerTab>('steps');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly viewerTabs: Array<{ id: ViewerTab; label: string }> = [
    { id: 'steps', label: 'Steps' },
    { id: 'log', label: 'Log' },
    { id: 'media', label: 'Screenshots & video' },
  ];

  readonly selectedResult = computed(() => {
    const run = this.run();
    const id = this.selectedResultId();
    if (!run || !id) return null;
    return run.testResults.find((result) => result.id === id) ?? null;
  });

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

  selectResult(result: TestResultDetail) {
    this.selectedResultId.set(result.id);
    this.viewerTab.set('steps');
    this.loadCaseLog(result.id);
  }

  refresh(showLoading = true) {
    if (showLoading) this.loading.set(true);
    this.testRunsService.get(this.runId).subscribe({
      next: (run) => {
        this.run.set(run);
        this.loading.set(false);

        if (!this.selectedResultId() && run.testResults.length > 0) {
          this.selectResult(run.testResults[0]);
        }

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
      next: (log) => this.runLog.set(log),
      error: () => undefined,
    });
  }

  loadCaseLog(resultId: string) {
    this.caseLogLoading.set(true);
    this.caseLog.set(null);
    this.testRunsService.getResultLog(resultId).subscribe({
      next: (log) => {
        this.caseLog.set(log);
        this.caseLogLoading.set(false);
      },
      error: () => {
        this.caseLogLoading.set(false);
      },
    });
  }

  mediaArtifacts(result: TestResultDetail): string[] {
    return result.artifactPaths.filter((path) => this.isImage(path) || this.isVideo(path));
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
