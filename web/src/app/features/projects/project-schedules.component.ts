import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Environment, Schedule, TestSuiteSummary } from '@playwright-platform/shared-types';
import { SchedulesService } from '../../core/services/schedules.service';
import { EnvironmentsService } from '../../core/services/environments.service';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { apiErrorMessage } from '../../shared/utils/api-error.util';

@Component({
  selector: 'app-project-schedules',
  imports: [ReactiveFormsModule],
  template: `
    <section class="card">
      <div class="panel-header">
        <div>
          <h3>Run schedules</h3>
          <p class="panel-desc">Cron-based automation for suite execution with optional failure alerts.</p>
        </div>
        <button
          class="btn btn-primary"
          type="button"
          (click)="toggleCreate()"
          [disabled]="suites().length === 0"
        >
          {{ showCreate() ? 'Cancel' : 'New schedule' }}
        </button>
      </div>

      @if (suites().length === 0) {
        <div class="empty-panel">
          <p>Create at least one test suite before scheduling automated runs.</p>
        </div>
      } @else {
        @if (showCreate()) {
          <div class="create-panel">
            <h4>Schedule configuration</h4>
            <form class="form" [formGroup]="form" (ngSubmit)="create()">
              <div class="form-grid">
                <label>
                  Schedule name
                  <input formControlName="name" placeholder="Nightly smoke" />
                </label>
                <label>
                  Cron expression
                  <input formControlName="cronExpression" placeholder="0 9 * * *" />
                  <span class="hint">Minute hour day month weekday — e.g. 0 9 * * * (daily 9:00)</span>
                </label>
                <label>
                  Environment
                  <select formControlName="environmentId">
                    <option value="">Default (example.com)</option>
                    @for (env of environments(); track env.id) {
                      <option [value]="env.id">{{ env.name }}</option>
                    }
                  </select>
                </label>
                <label class="checkbox-row">
                  <input type="checkbox" formControlName="enabled" />
                  Enabled on save
                </label>
              </div>

              <label>Suites to run</label>
              <div class="suite-checkboxes">
                @for (suite of suites(); track suite.id) {
                  <label class="checkbox-row">
                    <input
                      type="checkbox"
                      [checked]="isSuiteSelected(suite.id)"
                      (change)="toggleSuiteSelection(suite.id, $any($event.target).checked)"
                    />
                    {{ suite.name }}
                  </label>
                }
              </div>

              <details class="advanced-section">
                <summary>Failure notifications</summary>
                <div class="advanced-body">
                  <label class="checkbox-row">
                    <input type="checkbox" formControlName="notifyOnFailure" />
                    Notify when a scheduled run fails
                  </label>
                  <label>
                    Slack webhook URL
                    <input formControlName="slackWebhookUrl" placeholder="https://hooks.slack.com/..." />
                  </label>
                  <label>
                    Email recipients
                    <input formControlName="emailRecipients" placeholder="qa@example.com, dev@example.com" />
                  </label>
                </div>
              </details>

              @if (error()) {
                <p class="error">{{ error() }}</p>
              }
              <div class="form-actions">
                <button
                  class="btn btn-primary"
                  type="submit"
                  [disabled]="form.invalid || saving() || selectedSuiteIds().length === 0"
                >
                  Create schedule
                </button>
              </div>
            </form>
          </div>
        }

        @if (schedules().length === 0 && !showCreate()) {
          <div class="empty-panel">
            <p>No schedules configured.</p>
            <button class="btn btn-primary" type="button" (click)="toggleCreate()">Create schedule</button>
          </div>
        } @else if (schedules().length > 0) {
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Cron</th>
                <th>Suites</th>
                <th>Environment</th>
                <th>Alerts</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (schedule of schedules(); track schedule.id) {
                <tr>
                  <td><strong>{{ schedule.name }}</strong></td>
                  <td><code>{{ schedule.cronExpression }}</code></td>
                  <td>{{ schedule.suiteIds.length }}</td>
                  <td>{{ schedule.environmentName ?? 'Default' }}</td>
                  <td>
                    @if (
                      schedule.notificationConfig?.notifyOnFailure !== false &&
                      (schedule.notificationConfig?.slackWebhookUrl ||
                        schedule.notificationConfig?.emailRecipients?.length)
                    ) {
                      <span class="tag">On fail</span>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td>
                    <span class="status-pill" [class.enabled]="schedule.enabled">
                      {{ schedule.enabled ? 'Enabled' : 'Disabled' }}
                    </span>
                  </td>
                  <td class="actions-cell">
                    <button class="btn btn-link" type="button" (click)="runNow(schedule.id)">Run now</button>
                    <button class="btn btn-link" type="button" (click)="toggleEnabled(schedule)">
                      {{ schedule.enabled ? 'Disable' : 'Enable' }}
                    </button>
                    <button class="btn btn-danger" type="button" (click)="remove(schedule)">Delete</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
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

      h4 {
        margin: 0 0 1rem;
        font-size: 0.9375rem;
      }
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .suite-checkboxes {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 400;
      font-size: 0.875rem;
    }

    .advanced-section {
      margin: 1rem 0;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      background: #fff;

      summary {
        cursor: pointer;
        font-weight: 500;
        font-size: 0.875rem;
      }
    }

    .advanced-body {
      display: grid;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }

    .empty-panel {
      text-align: center;
      padding: 2.5rem 1rem;
      color: #64748b;

      p {
        margin: 0 0 1rem;
      }
    }

    code {
      font-size: 0.8125rem;
    }

    .status-pill {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      background: #f1f5f9;
      color: #64748b;

      &.enabled {
        background: #dcfce7;
        color: #15803d;
      }
    }

    .muted {
      color: #94a3b8;
    }
  `,
})
export class ProjectSchedulesComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly schedulesService = inject(SchedulesService);
  private readonly environmentsService = inject(EnvironmentsService);
  private readonly testSuitesService = inject(TestSuitesService);
  private readonly fb = inject(FormBuilder);

  projectId = '';
  readonly schedules = signal<Schedule[]>([]);
  readonly environments = signal<Environment[]>([]);
  readonly suites = signal<TestSuiteSummary[]>([]);
  readonly selectedSuiteIds = signal<string[]>([]);
  readonly showCreate = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    cronExpression: ['', Validators.required],
    environmentId: [''],
    enabled: [true],
    notifyOnFailure: [true],
    slackWebhookUrl: [''],
    emailRecipients: [''],
  });

  ngOnInit() {
    this.projectId = this.route.parent?.snapshot.paramMap.get('projectId') ?? '';
    this.load();
    this.environmentsService.listByProject(this.projectId).subscribe({
      next: (data) => this.environments.set(data),
    });
    this.testSuitesService.listByProject(this.projectId).subscribe({
      next: (data) => this.suites.set(data),
    });
  }

  load() {
    this.schedulesService.listByProject(this.projectId).subscribe({
      next: (data) => this.schedules.set(data),
    });
  }

  toggleCreate() {
    this.showCreate.update((v) => !v);
    this.error.set(null);
  }

  isSuiteSelected(suiteId: string) {
    return this.selectedSuiteIds().includes(suiteId);
  }

  toggleSuiteSelection(suiteId: string, checked: boolean) {
    this.selectedSuiteIds.update((ids) =>
      checked ? [...new Set([...ids, suiteId])] : ids.filter((id) => id !== suiteId),
    );
  }

  create() {
    if (this.form.invalid || this.selectedSuiteIds().length === 0) return;
    this.saving.set(true);
    this.error.set(null);
    const { name, cronExpression, environmentId, enabled, notifyOnFailure, slackWebhookUrl, emailRecipients } =
      this.form.getRawValue();
    const recipients = emailRecipients
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    this.schedulesService
      .create(this.projectId, {
        name,
        cronExpression,
        suiteIds: this.selectedSuiteIds(),
        environmentId: environmentId || undefined,
        enabled,
        notificationConfig: {
          notifyOnFailure,
          slackWebhookUrl: slackWebhookUrl.trim() || undefined,
          emailRecipients: recipients.length > 0 ? recipients : undefined,
        },
      })
      .subscribe({
        next: () => {
          this.form.reset({
            name: '',
            cronExpression: '',
            environmentId: '',
            enabled: true,
            notifyOnFailure: true,
            slackWebhookUrl: '',
            emailRecipients: '',
          });
          this.selectedSuiteIds.set([]);
          this.saving.set(false);
          this.showCreate.set(false);
          this.load();
        },
        error: (err) => {
          this.error.set(apiErrorMessage(err, 'Failed to create schedule.'));
          this.saving.set(false);
        },
      });
  }

  toggleEnabled(schedule: Schedule) {
    this.schedulesService.update(schedule.id, { enabled: !schedule.enabled }).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(apiErrorMessage(err, 'Failed to update schedule.')),
    });
  }

  runNow(scheduleId: string) {
    this.error.set(null);
    this.schedulesService.runNow(scheduleId).subscribe({
      error: (err) => this.error.set(apiErrorMessage(err, 'Failed to trigger schedule.')),
    });
  }

  remove(schedule: Schedule) {
    if (!confirm(`Delete schedule "${schedule.name}"?`)) return;
    this.schedulesService.delete(schedule.id).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(apiErrorMessage(err, 'Failed to delete schedule.')),
    });
  }
}
