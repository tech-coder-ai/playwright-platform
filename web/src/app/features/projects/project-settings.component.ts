import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Environment, RunArtifactsConfig, SecretMeta } from '@playwright-platform/shared-types';
import { EnvironmentsService } from '../../core/services/environments.service';
import { SecretsService } from '../../core/services/secrets.service';
import { ProjectsService } from '../../core/services/projects.service';
import { apiErrorMessage } from '../../shared/utils/api-error.util';

type SettingsTab = 'environments' | 'secrets' | 'capture';

@Component({
  selector: 'app-project-settings',
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <div class="settings-layout">
      <aside class="settings-nav">
        <button
          type="button"
          [class.active]="activeTab() === 'environments'"
          (click)="activeTab.set('environments')"
        >
          Environments
        </button>
        <button
          type="button"
          [class.active]="activeTab() === 'secrets'"
          (click)="activeTab.set('secrets')"
        >
          Secrets
        </button>
        <button
          type="button"
          [class.active]="activeTab() === 'capture'"
          (click)="activeTab.set('capture')"
        >
          Run capture
        </button>
      </aside>

      <div class="settings-panel">
        @if (activeTab() === 'environments') {
          <section class="card flat">
            <div class="panel-header">
              <div>
                <h3>Environments</h3>
                <p class="panel-desc">Target URLs used when running and scheduling tests.</p>
              </div>
              <button class="btn btn-primary" type="button" (click)="toggleEnvCreate()">
                {{ showEnvCreate() ? 'Cancel' : 'Add environment' }}
              </button>
            </div>

            @if (showEnvCreate()) {
              <div class="create-panel">
                <form class="inline-form" [formGroup]="envForm" (ngSubmit)="createEnvironment()">
                  <label>
                    Name
                    <input formControlName="name" placeholder="staging" />
                  </label>
                  <label>
                    Base URL
                    <input formControlName="baseUrl" placeholder="https://staging.example.com" />
                  </label>
                  <button class="btn btn-primary" type="submit" [disabled]="envForm.invalid || envSaving()">
                    Save
                  </button>
                </form>
              </div>
            }

            @if (envError()) {
              <p class="error">{{ envError() }}</p>
            }

            @if (environments().length === 0) {
              <p class="empty">No environments configured.</p>
            } @else {
              <table class="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Base URL</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (env of environments(); track env.id) {
                    <tr>
                      @if (editingEnvId() === env.id) {
                        <td colspan="3">
                          <form class="inline-form" [formGroup]="envEditForm" (ngSubmit)="saveEnvironment(env.id)">
                            <label>
                              Name
                              <input formControlName="name" />
                            </label>
                            <label>
                              Base URL
                              <input formControlName="baseUrl" />
                            </label>
                            <button class="btn btn-primary" type="submit">Save</button>
                            <button class="btn btn-secondary" type="button" (click)="cancelEnvEdit()">Cancel</button>
                          </form>
                        </td>
                      } @else {
                        <td>{{ env.name }}</td>
                        <td>{{ env.baseUrl }}</td>
                        <td class="actions-cell">
                          <button class="btn btn-link" type="button" (click)="startEnvEdit(env)">Edit</button>
                          <button class="btn btn-danger" type="button" (click)="removeEnvironment(env)">Delete</button>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>
        }

        @if (activeTab() === 'secrets') {
          <section class="card flat">
            <div class="panel-header">
              <div>
                <h3>Secrets</h3>
                <p class="panel-desc">Write-only credentials injected at run time. Values are never displayed.</p>
              </div>
              <button class="btn btn-primary" type="button" (click)="toggleSecretCreate()">
                {{ showSecretCreate() ? 'Cancel' : 'Add secret' }}
              </button>
            </div>

            @if (showSecretCreate()) {
              <div class="create-panel">
                <form class="form" [formGroup]="secretForm" (ngSubmit)="createSecret()">
                  <div class="form-grid">
                    <label>
                      Name
                      <input formControlName="name" placeholder="API_KEY" autocomplete="off" />
                    </label>
                    <label>
                      Scope
                      <select formControlName="environmentId">
                        <option value="">All environments</option>
                        @for (env of environments(); track env.id) {
                          <option [value]="env.id">{{ env.name }}</option>
                        }
                      </select>
                    </label>
                  </div>
                  <label>
                    Value
                    <input type="password" formControlName="value" autocomplete="new-password" />
                  </label>
                  <div class="form-actions">
                    <button class="btn btn-primary" type="submit" [disabled]="secretForm.invalid || secretSaving()">
                      Save secret
                    </button>
                  </div>
                </form>
              </div>
            }

            @if (secretError()) {
              <p class="error">{{ secretError() }}</p>
            }

            @if (secrets().length === 0) {
              <p class="empty">No secrets configured.</p>
            } @else {
              <table class="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Scope</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (secret of secrets(); track secret.id) {
                    <tr>
                      @if (editingSecretId() === secret.id) {
                        <td colspan="4">
                          <form class="form" [formGroup]="secretEditForm" (ngSubmit)="saveSecret(secret.id)">
                            <div class="form-grid">
                              <label>
                                Name
                                <input formControlName="name" autocomplete="off" />
                              </label>
                              <label>
                                Scope
                                <select formControlName="environmentId">
                                  <option value="">All environments</option>
                                  @for (env of environments(); track env.id) {
                                    <option [value]="env.id">{{ env.name }}</option>
                                  }
                                </select>
                              </label>
                            </div>
                            <label>
                              New value
                              <input type="password" formControlName="value" autocomplete="new-password" />
                              <span class="hint">Leave blank to keep current value</span>
                            </label>
                            <div class="form-actions">
                              <button class="btn btn-primary" type="submit">Save</button>
                              <button class="btn btn-secondary" type="button" (click)="cancelSecretEdit()">Cancel</button>
                            </div>
                          </form>
                        </td>
                      } @else {
                        <td><code>{{ secret.name }}</code></td>
                        <td>{{ secret.environmentName ?? 'All environments' }}</td>
                        <td>{{ secret.updatedAt | date: 'medium' }}</td>
                        <td class="actions-cell">
                          <button class="btn btn-link" type="button" (click)="startSecretEdit(secret)">Edit</button>
                          <button class="btn btn-danger" type="button" (click)="removeSecret(secret)">Delete</button>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>
        }

        @if (activeTab() === 'capture') {
          <section class="card flat">
            <div class="panel-header">
              <div>
                <h3>Run capture</h3>
                <p class="panel-desc">
                  Control screenshots and video saved during suite runs. Applies to all runs in this project.
                </p>
              </div>
            </div>

            <form class="form capture-form" [formGroup]="captureForm" (ngSubmit)="saveCaptureSettings()">
              <label>
                Screenshots
                <select formControlName="screenshot">
                  <option value="off">Off</option>
                  <option value="on-failure">On failure only</option>
                  <option value="on">Every step (Gherkin) / every action (Playwright)</option>
                </select>
              </label>
              <label>
                Video
                <select formControlName="video">
                  <option value="off">Off</option>
                  <option value="on-failure">On failure only</option>
                  <option value="on">Always record</option>
                </select>
              </label>

              @if (captureError()) {
                <p class="error">{{ captureError() }}</p>
              }
              @if (captureMessage()) {
                <p class="success">{{ captureMessage() }}</p>
              }

              <div class="form-actions">
                <button class="btn btn-primary" type="submit" [disabled]="captureForm.invalid || captureSaving()">
                  {{ captureSaving() ? 'Saving…' : 'Save capture settings' }}
                </button>
              </div>
            </form>
          </section>
        }
      </div>
    </div>
  `,
  styles: `
    .settings-layout {
      display: grid;
      grid-template-columns: 11rem 1fr;
      gap: 1.25rem;
      align-items: start;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .settings-nav {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.5rem;

      button {
        text-align: left;
        padding: 0.625rem 0.75rem;
        border: none;
        background: none;
        border-radius: 8px;
        font: inherit;
        font-size: 0.875rem;
        font-weight: 500;
        color: #64748b;
        cursor: pointer;

        &:hover {
          background: #f8fafc;
          color: #334155;
        }

        &.active {
          background: #eef2ff;
          color: #4f46e5;
        }
      }
    }

    .card.flat {
      margin-bottom: 0;
    }

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
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    code {
      font-size: 0.8125rem;
    }

    .capture-form {
      max-width: 28rem;
    }

    .success {
      color: #15803d;
      font-size: 0.875rem;
      margin: 0;
    }
  `,
})
export class ProjectSettingsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly environmentsService = inject(EnvironmentsService);
  private readonly secretsService = inject(SecretsService);
  private readonly projectsService = inject(ProjectsService);
  private readonly fb = inject(FormBuilder);

  projectId = '';
  readonly activeTab = signal<SettingsTab>('environments');
  readonly environments = signal<Environment[]>([]);
  readonly secrets = signal<SecretMeta[]>([]);
  readonly showEnvCreate = signal(false);
  readonly showSecretCreate = signal(false);
  readonly envSaving = signal(false);
  readonly secretSaving = signal(false);
  readonly captureSaving = signal(false);
  readonly envError = signal<string | null>(null);
  readonly secretError = signal<string | null>(null);
  readonly captureError = signal<string | null>(null);
  readonly captureMessage = signal<string | null>(null);
  readonly editingEnvId = signal<string | null>(null);
  readonly editingSecretId = signal<string | null>(null);

  readonly envForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    baseUrl: ['', Validators.required],
  });

  readonly envEditForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    baseUrl: ['', Validators.required],
  });

  readonly secretForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    environmentId: [''],
    value: ['', Validators.required],
  });

  readonly secretEditForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    environmentId: [''],
    value: [''],
  });

  readonly captureForm = this.fb.nonNullable.group({
    screenshot: ['on-failure' as RunArtifactsConfig['screenshot'], Validators.required],
    video: ['on-failure' as RunArtifactsConfig['video'], Validators.required],
  });

  ngOnInit() {
    this.projectId = this.route.parent?.snapshot.paramMap.get('projectId') ?? '';
    this.loadEnvironments();
    this.loadSecrets();
    this.loadCaptureSettings();
  }

  loadCaptureSettings() {
    this.projectsService.get(this.projectId).subscribe({
      next: (project) => {
        const config = project.runArtifactsConfig ?? { screenshot: 'on-failure', video: 'on-failure' };
        this.captureForm.setValue({
          screenshot: config.screenshot,
          video: config.video,
        });
      },
    });
  }

  saveCaptureSettings() {
    if (this.captureForm.invalid) return;
    this.captureSaving.set(true);
    this.captureError.set(null);
    this.captureMessage.set(null);
    this.projectsService
      .update(this.projectId, { runArtifactsConfig: this.captureForm.getRawValue() })
      .subscribe({
        next: () => {
          this.captureSaving.set(false);
          this.captureMessage.set('Capture settings saved.');
        },
        error: (err) => {
          this.captureError.set(apiErrorMessage(err, 'Failed to save capture settings.'));
          this.captureSaving.set(false);
        },
      });
  }

  loadEnvironments() {
    this.environmentsService.listByProject(this.projectId).subscribe({
      next: (data) => this.environments.set(data),
    });
  }

  loadSecrets() {
    this.secretsService.listByProject(this.projectId).subscribe({
      next: (data) => this.secrets.set(data),
    });
  }

  toggleEnvCreate() {
    this.showEnvCreate.update((v) => !v);
    this.envError.set(null);
  }

  toggleSecretCreate() {
    this.showSecretCreate.update((v) => !v);
    this.secretError.set(null);
  }

  createEnvironment() {
    if (this.envForm.invalid) return;
    this.envSaving.set(true);
    this.envError.set(null);
    this.environmentsService.create(this.projectId, this.envForm.getRawValue()).subscribe({
      next: () => {
        this.envForm.reset({ name: '', baseUrl: '' });
        this.envSaving.set(false);
        this.showEnvCreate.set(false);
        this.loadEnvironments();
        this.projectsService.get(this.projectId).subscribe();
      },
      error: () => {
        this.envError.set('Failed to add environment.');
        this.envSaving.set(false);
      },
    });
  }

  startEnvEdit(env: Environment) {
    this.editingEnvId.set(env.id);
    this.envEditForm.setValue({ name: env.name, baseUrl: env.baseUrl });
  }

  cancelEnvEdit() {
    this.editingEnvId.set(null);
  }

  saveEnvironment(id: string) {
    if (this.envEditForm.invalid) return;
    this.environmentsService.update(id, this.envEditForm.getRawValue()).subscribe({
      next: () => {
        this.editingEnvId.set(null);
        this.loadEnvironments();
      },
      error: () => this.envError.set('Failed to update environment.'),
    });
  }

  removeEnvironment(env: Environment) {
    if (!confirm(`Delete environment "${env.name}"?`)) return;
    this.environmentsService.delete(env.id).subscribe({
      next: () => {
        this.loadEnvironments();
        this.loadSecrets();
        this.projectsService.get(this.projectId).subscribe();
      },
      error: () => this.envError.set('Failed to delete environment.'),
    });
  }

  createSecret() {
    if (this.secretForm.invalid) return;
    this.secretSaving.set(true);
    this.secretError.set(null);
    const { name, environmentId, value } = this.secretForm.getRawValue();
    this.secretsService
      .create(this.projectId, { name, value, environmentId: environmentId || undefined })
      .subscribe({
        next: () => {
          this.secretForm.reset({ name: '', environmentId: '', value: '' });
          this.secretSaving.set(false);
          this.showSecretCreate.set(false);
          this.loadSecrets();
        },
        error: (err) => {
          this.secretError.set(apiErrorMessage(err, 'Failed to add secret.'));
          this.secretSaving.set(false);
        },
      });
  }

  startSecretEdit(secret: SecretMeta) {
    this.editingSecretId.set(secret.id);
    this.secretEditForm.setValue({
      name: secret.name,
      environmentId: secret.environmentId ?? '',
      value: '',
    });
  }

  cancelSecretEdit() {
    this.editingSecretId.set(null);
    this.secretError.set(null);
  }

  saveSecret(id: string) {
    if (this.secretEditForm.invalid) return;
    const { name, environmentId, value } = this.secretEditForm.getRawValue();
    this.secretsService
      .update(id, {
        name,
        environmentId: environmentId || null,
        ...(value ? { value } : {}),
      })
      .subscribe({
        next: () => {
          this.editingSecretId.set(null);
          this.loadSecrets();
        },
        error: (err) => this.secretError.set(apiErrorMessage(err, 'Failed to update secret.')),
      });
  }

  removeSecret(secret: SecretMeta) {
    if (!confirm(`Delete secret "${secret.name}"?`)) return;
    this.secretsService.delete(secret.id).subscribe({
      next: () => this.loadSecrets(),
      error: (err) => this.secretError.set(apiErrorMessage(err, 'Failed to delete secret.')),
    });
  }
}
