import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { GameballService } from '../../services/gameball.service';
import { SessionService } from '../../services/session.service';
import {
  BalanceResponse,
  TierResponse,
  BadgeProgress,
} from '../../models/gameball.models';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  form = {
    mobile: '',
    gender: '' as 'M' | 'F' | '',
    dateOfBirth: '',
  };

  balance: BalanceResponse | null = null;
  tier: TierResponse | null = null;
  badges: BadgeProgress[] = [];

  loadingProfile = false;
  loadingLoyalty = true;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null = null;

  constructor(
    private gameball: GameballService,
    public session: SessionService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (!this.session.isLoggedIn()) {
      this.router.navigate(['/signup']);
      return;
    }
    this.loadProfile();
    this.loadLoyaltyData();
  }

  // ─────────────────────────────────────────────
  // Load all loyalty data in parallel
  // forkJoin fires all 3 requests simultaneously
  // catchError on each makes them independent —
  // one failure won't cancel the others
  // ─────────────────────────────────────────────
  loadLoyaltyData(): void {
    const customerId = this.session.getUser()!.customerId;
    this.loadingLoyalty = true;

    forkJoin({
      balance: this.gameball.getCustomerBalance(customerId).pipe(
        catchError((err) => {
          console.warn('Balance error:', err);
          return of(null);
        }),
      ),
      tier: this.gameball.getCustomerTier(customerId).pipe(
        catchError((err) => {
          console.warn('Tier error:', err);
          return of(null);
        }),
      ),
      badges: this.gameball.getBadgesProgress(customerId).pipe(
        catchError((err) => {
          console.warn('Badges error:', err);
          return of([]);
        }),
      ),
    }).subscribe({
      next: ({ balance, tier, badges }) => {
        this.balance = balance;
        this.tier = tier;
        this.badges = badges as BadgeProgress[];
        this.loadingLoyalty = false;
      },
      error: (err) => {
        console.error('Failed to load loyalty data:', err);
        this.loadingLoyalty = false;
        this.showToast('Could not load loyalty data.', 'error');
      },
    });
  }

  // ─────────────────────────────────────────────
  // Save profile + fire profile_completed event
  // Uses switchMap to chain two API calls cleanly —
  // first update the customer record, then fire the event.
  // switchMap flattens the inner observable so we avoid
  // nested .subscribe() calls (anti-pattern in RxJS)
  // ─────────────────────────────────────────────
  // ─── Validation helpers ───
  private isValidPhone(phone: string): boolean {
    // Accepts formats: +201001234567, 01001234567, +1-800-555-0199
    return /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{3,5}[-\s.]?[0-9]{4,10}$/.test(
      phone.trim(),
    );
  }

  private isValidDOB(dob: string): boolean {
    const date = new Date(dob);
    const now = new Date();
    const minAge = new Date();
    minAge.setFullYear(now.getFullYear() - 120); // max 120 years old
    const maxAge = new Date();
    maxAge.setFullYear(now.getFullYear() - 13); // min 13 years old
    return date <= maxAge && date >= minAge;
  }

  onSaveProfile(): void {
    if (!this.form.mobile || !this.form.gender || !this.form.dateOfBirth) {
      this.showToast('Please fill in all profile fields.', 'error');
      return;
    }
    if (!this.isValidPhone(this.form.mobile)) {
      this.showToast(
        'Please enter a valid phone number (e.g. +201001234567).',
        'error',
      );
      return;
    }
    if (!this.isValidDOB(this.form.dateOfBirth)) {
      this.showToast(
        'Please enter a valid date of birth. You must be at least 13 years old.',
        'error',
      );
      return;
    }

    const user = this.session.getUser()!;
    this.loadingProfile = true;

    // Step 1: Update customer attributes in Gameball
    this.gameball
      .registerCustomer({
        customerId: user.customerId,
        customerAttributes: {
          displayName: user.displayName,
          email: user.email,
          mobile: this.form.mobile,
          gender: this.form.gender as 'M' | 'F',
          dateOfBirth: new Date(this.form.dateOfBirth).toISOString(),
        },
      })
      .pipe(
        // Step 2: Chain the event call using switchMap — no nesting needed
        switchMap(() =>
          this.gameball.sendEvent({
            customerId: user.customerId,
            events: {
              profile_completed: {
                email: user.email,
                phone: this.form.mobile,
                name: user.displayName,
                gender: this.form.gender,
                date_of_birth: this.form.dateOfBirth,
              },
            },
          }),
        ),
      )
      .subscribe({
        next: () => {
          this.session.updateUser({
            mobile: this.form.mobile,
            gender: this.form.gender as 'M' | 'F',
            dateOfBirth: this.form.dateOfBirth,
            profileCompleted: true,
          });

          this.loadingProfile = false;
          this.showToast(
            'Profile saved! Points may have been awarded 🎉',
            'success',
          );
          setTimeout(() => this.loadLoyaltyData(), 1000);
        },
        error: (err) => {
          this.loadingProfile = false;
          console.error('Profile save error:', err);
          this.showToast('Failed to save profile.', 'error');
        },
      });
  }

  get tierProgressPercent(): number {
    if (!this.tier) return 0;
    const progress = this.tier.progress;
    const threshold = this.tier.next?.minPorgress; // Gameball API typo
    if (!threshold || threshold === 0) return 0;
    return Math.min(100, Math.round((progress / threshold) * 100));
  }

  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    this.toast = { message, type };
    setTimeout(() => (this.toast = null), 3500);
  }
  // get user profile data (for profile completion event)
  private loadProfile(): void {
    const customerId = this.session.getUser()!.customerId;
    this.gameball.getCustomerProfile(customerId).subscribe({
      next: (profile) => {
        this.form.mobile = profile.customerAttributes.mobile || '';
        this.form.gender = profile.customerAttributes.gender || '';
        const dob = profile.customerAttributes.dateOfBirth;
        this.form.dateOfBirth = dob
          ? (() => {
              const d = new Date(dob);
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            })()
          : '';
      },
    });
  }
}
