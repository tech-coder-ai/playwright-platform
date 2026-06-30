import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PageObject } from '@playwright-platform/shared-types';
import { ProjectsService } from '../../core/services/projects.service';
import { PageObjectsService } from '../../core/services/page-objects.service';

@Component({
  selector: 'app-page-objects-list',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="page-header">
      <div>
        <div class="breadcrumb">
          <a routerLink="/projects">Projects</a> /
          <a [routerLink]="['/projects', projectId]">{{ projectName() }}</a> /
          Page objects
        </div>
        <h2>Page objects</h2>
      </div>
      <a [routerLink]="['/projects', projectId, 'page-objects', 'recorder']" class="btn btn-primary">
        Record new screen
      </a>
    </div>

    @if (loading()) {
      <p class="empty">Loading…</p>
    } @else if (pageObjects().length === 0) {
      <p class="empty">No page objects yet. Record a screen to create one.</p>
    } @else {
      <section class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Screen</th>
              <th>Class</th>
              <th>Version</th>
              <th>File</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (po of pageObjects(); track po.id) {
              <tr>
                <td>{{ po.screenName }}</td>
                <td><code>{{ po.name }}</code></td>
                <td>v{{ po.version }}</td>
                <td><code>{{ po.classFilePath }}</code></td>
                <td>{{ po.updatedAt | date: 'short' }}</td>
                <td class="actions-cell">
                  <a
                    class="btn btn-link"
                    [routerLink]="['/projects', projectId, 'page-objects', 'recorder']"
                    [queryParams]="{ reRecordId: po.id }"
                  >
                    Re-record
                  </a>
                  <button class="btn btn-danger" type="button" (click)="remove(po)">Delete</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    }
  `,
  styles: `
    code {
      font-size: 0.8125rem;
    }
  `,
})
export class PageObjectsListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly projectsService = inject(ProjectsService);
  private readonly pageObjectsService = inject(PageObjectsService);

  projectId = '';
  readonly projectName = signal('Project');
  readonly pageObjects = signal<PageObject[]>([]);
  readonly loading = signal(true);

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
    this.projectsService.get(this.projectId).subscribe({
      next: (p) => this.projectName.set(p.name),
    });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.pageObjectsService.listByProject(this.projectId).subscribe({
      next: (items) => {
        this.pageObjects.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  remove(po: PageObject) {
    if (!confirm(`Delete page object "${po.name}"?`)) return;
    this.pageObjectsService.delete(po.id).subscribe({
      next: () => this.load(),
    });
  }
}
