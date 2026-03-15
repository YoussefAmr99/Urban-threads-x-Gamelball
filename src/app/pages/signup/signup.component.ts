import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameballService } from '../../services/gameball.service';
import { SessionService } from '../../services/session.service';

const TEST_USER = {
  customerId: 'Ut_finaltest_gmail_com',
  displayName: 'finalTest',
  email: 'finaltest@gmail.com',
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

  onSubmit(): void {
    if (!this.form.displayName || !this.form.email || !this.form.password) {
      this.showToast('Please fill in all fields.', 'error');
      return;
    }

    this.loading = true;

    // Generate a stable unique ID from email — in production this
    // would be your internal database user ID
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
          // Save to session (no DB needed)
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

          // Navigate to profile after short delay so user sees toast
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
