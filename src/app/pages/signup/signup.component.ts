import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameballService } from '../../services/gameball.service';
import { SessionService } from '../../services/session.service';

// ─── Hardcode your test user here so you never have to re-sign up ───
const TEST_USER = {
  customerId: 'Ut_test_urbanthreads_com', // ← your existing Gameball customer ID
  displayName: 'Test Account',
  email: 'test@urbanthreads.com',
  profileCompleted: true,
};

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
})
export class SignupComponent {
  form = {
    displayName: '',
    email: '',
    password: '',
  };

  loading = false;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null = null;

  constructor(
    private gameball: GameballService,
    private session: SessionService,
    private router: Router,
  ) {}

  // ─────────────────────────────────────────────
  // Quick login — restores hardcoded test session
  // No API call needed, just restores session state
  // ─────────────────────────────────────────────
  continueAsTestUser(): void {
    this.session.setUser(TEST_USER);
    this.router.navigate(['/profile']);
  }

  // ─── Validation helpers ───
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidPassword(password: string): boolean {
    return password.length >= 6;
  }

  onSubmit(): void {
    if (!this.form.displayName.trim()) {
      this.showToast('Please enter your full name.', 'error');
      return;
    }
    if (!this.isValidEmail(this.form.email)) {
      this.showToast('Please enter a valid email address.', 'error');
      return;
    }
    if (!this.isValidPassword(this.form.password)) {
      this.showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    this.loading = true;

    const customerId = 'ut_' + this.form.email.replace(/[^a-zA-Z0-9]/g, '_');

    this.gameball
      .registerCustomer({
        customerId,
        customerAttributes: {
          displayName: this.form.displayName,
          email: this.form.email,
        },
      })
      .subscribe({
        next: () => {
          this.session.setUser({
            customerId,
            displayName: this.form.displayName,
            email: this.form.email,
            profileCompleted: false,
          });

          this.loading = false;
          this.showToast(
            `Welcome to UrbanThreads, ${this.form.displayName}! 🎉`,
            'success',
          );
          setTimeout(() => this.router.navigate(['/profile']), 1500);
        },
        error: (err) => {
          this.loading = false;
          console.error('Gameball registration error:', err);
          this.showToast('Registration failed. Check your API keys.', 'error');
        },
      });
  }

  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    this.toast = { message, type };
    setTimeout(() => (this.toast = null), 3500);
  }
}
