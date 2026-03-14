import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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

  // Loyalty data from Gameball
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
  // Load all loyalty data in parallel
  // Uses forkJoin to fire 3 requests simultaneously
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
        // 404 = no campaigns configured yet — treat as empty array, not an error
        catchError((err) => {
          console.warn('Badges not configured yet:', err);
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
        this.showToast('Could not load loyalty data. Check API keys.', 'error');
      },
    });
  }

  // ─────────────────────────────────────────────
  // Send profile_completed event
  // Also updates Gameball customer record with
  // the additional profile fields
  // ─────────────────────────────────────────────
  onSaveProfile(): void {
    if (!this.form.mobile || !this.form.gender || !this.form.dateOfBirth) {
      this.showToast('Please fill in all profile fields.', 'error');
      return;
    }

    const user = this.session.getUser()!;
    this.loadingProfile = true;

    // Step 1: Update Gameball customer record with new attributes
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
      .subscribe({
        next: () => {
          // Step 2: Fire the profile_completed event with metadata
          this.gameball
            .sendEvent({
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
            })
            .subscribe({
              next: () => {
                // Update local session
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

                // Refresh loyalty data to reflect any new points
                setTimeout(() => this.loadLoyaltyData(), 1000);
              },
              error: (err) => {
                this.loadingProfile = false;
                console.error('Event error:', err);
                this.showToast('Profile saved but event failed.', 'error');
              },
            });
        },
        error: (err) => {
          this.loadingProfile = false;
          console.error('Customer update error:', err);
          this.showToast('Failed to save profile.', 'error');
        },
      });
  }

  get tierProgressPercent(): number {
    if (!this.tier) return 0;
    const progress = this.tier.progress;
    const threshold = this.tier.next?.minProgress;
    if (!threshold) return 100;
    return Math.min(100, Math.round((progress / threshold) * 100));
  }

  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    this.toast = { message, type };
    setTimeout(() => (this.toast = null), 3500);
  }
}
