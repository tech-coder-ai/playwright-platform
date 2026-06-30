import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { User, UserRole } from '@playwright-platform/shared-types';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';
import { apiErrorMessage } from '../../shared/utils/api-error.util';

@Component({
  selector: 'app-users',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-header">
      <div>
        <div class="breadcrumb"><a routerLink="/">Dashboard</a> / Users</div>
        <h2>Users</h2>
      </div>
    </div>

    <section class="card">
      <h3>Add user</h3>
      <form class="form" [formGroup]="form" (ngSubmit)="create()">
        <label>
          Email
          <input type="email" formControlName="email" />
        </label>
        <label>
          Password
          <input type="password" formControlName="password" />
        </label>
        <label>
          Role
          <select formControlName="role">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <button class="btn btn-primary" type="submit" [disabled]="form.invalid || saving()">
          Create user
        </button>
      </form>
    </section>

    <section class="card">
      <h3>All users</h3>
      @if (users().length === 0) {
        <p class="empty">No users.</p>
      } @else {
        <table class="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (user of users(); track user.id) {
              <tr>
                <td>{{ user.email }}</td>
                <td>{{ user.role }}</td>
                <td>
                  @if (user.id !== currentUserId()) {
                    <button class="btn btn-danger" type="button" (click)="remove(user)">Delete</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
})
export class UsersComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly users = signal<User[]>([]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['viewer' as UserRole, Validators.required],
  });

  ngOnInit() {
    this.load();
  }

  currentUserId() {
    return this.auth.currentUser()?.id;
  }

  load() {
    this.usersService.list().subscribe({
      next: (users) => this.users.set(users),
      error: (err) => this.error.set(apiErrorMessage(err, 'Failed to load users.')),
    });
  }

  create() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.usersService.create(this.form.getRawValue()).subscribe({
      next: () => {
        this.form.reset({ email: '', password: '', role: 'viewer' });
        this.saving.set(false);
        this.load();
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Failed to create user.'));
        this.saving.set(false);
      },
    });
  }

  remove(user: User) {
    if (!confirm(`Delete user ${user.email}?`)) return;
    this.usersService.delete(user.id).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(apiErrorMessage(err, 'Failed to delete user.')),
    });
  }
}
