import { Injectable, signal } from '@angular/core';
import { SessionUser } from '../models/gameball.models';

@Injectable({ providedIn: 'root' })
export class SessionService {
  // Angular signals for reactive state sharing across components
  private _user = signal<SessionUser | null>(null);

  readonly user = this._user.asReadonly();

  setUser(user: SessionUser): void {
    this._user.set(user);
  }

  updateUser(partial: Partial<SessionUser>): void {
    const current = this._user();
    if (current) {
      this._user.set({ ...current, ...partial });
    }
  }

  getUser(): SessionUser | null {
    return this._user();
  }

  isLoggedIn(): boolean {
    return this._user() !== null;
  }

  clear(): void {
    this._user.set(null);
  }
}
