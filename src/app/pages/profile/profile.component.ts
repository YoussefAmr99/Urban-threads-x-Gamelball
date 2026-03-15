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
    this.loadLoyaltyData();
  }

  // ─────────────────────────────────────────────
  // TASK 4: Load all loyalty data in parallel
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
  // TASK 2a: Save profile + fire profile_completed event
  // Uses switchMap to chain two API calls cleanly —
  // first update the customer record, then fire the event.
  // switchMap flattens the inner observable so we avoid
  // nested .subscribe() calls (anti-pattern in RxJS)
  // ─────────────────────────────────────────────
  onSaveProfile(): void {
    if (!this.form.mobile || !this.form.gender || !this.form.dateOfBirth) {
      this.showToast('Please fill in all profile fields.', 'error');
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
}
