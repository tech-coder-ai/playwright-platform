import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/projects-list.component').then((m) => m.ProjectsListComponent),
  },
  {
    path: 'projects/:projectId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/project-shell.component').then((m) => m.ProjectShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/projects/project-overview.component').then((m) => m.ProjectOverviewComponent),
      },
      {
        path: 'suites',
        loadComponent: () =>
          import('./features/projects/project-suites.component').then((m) => m.ProjectSuitesComponent),
      },
      {
        path: 'schedules',
        loadComponent: () =>
          import('./features/projects/project-schedules.component').then((m) => m.ProjectSchedulesComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/projects/project-settings.component').then((m) => m.ProjectSettingsComponent),
      },
    ],
  },
  {
    path: 'projects/:projectId/page-objects',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/page-objects/page-objects-list.component').then(
        (m) => m.PageObjectsListComponent,
      ),
  },
  {
    path: 'projects/:projectId/page-objects/recorder',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/page-objects/page-object-recorder.component').then(
        (m) => m.PageObjectRecorderComponent,
      ),
  },
  {
    path: 'projects/:projectId/recorder',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/recorder/recorder.component').then((m) => m.RecorderComponent),
  },
  {
    path: 'projects/:projectId/runs/:runId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/test-runs/run-detail.component').then((m) => m.RunDetailComponent),
  },
  {
    path: 'projects/:projectId/suites/:suiteId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/test-suites/suite-detail.component').then((m) => m.SuiteDetailComponent),
  },
  {
    path: 'projects/:projectId/suites/:suiteId/tests/:testCaseId/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/test-suites/test-case-editor.component').then(
        (m) => m.TestCaseEditorComponent,
      ),
  },
  {
    path: 'unit-test-prompts',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/unit-test-prompts/unit-test-prompts.component').then(
        (m) => m.UnitTestPromptsComponent,
      ),
  },
  {
    path: 'users',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/users/users.component').then((m) => m.UsersComponent),
  },
];
