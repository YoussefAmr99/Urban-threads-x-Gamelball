import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  CustomerRegistration,
  EventPayload,
  BalanceResponse,
  TierResponse,
  BadgeProgress,
  CampaignDefinition,
  CampaignProgress,
} from '../models/gameball.models';

@Injectable({ providedIn: 'root' })
export class GameballService {
  private readonly baseUrl = environment.gameballBaseUrl;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      apikey: environment.gameballApiKey,
      secretkey: environment.gameballSecretKey,
    });
  }

  // ─────────────────────────────────────────────
  // Register / update a customer
  // POST /integrations/customers
  // ─────────────────────────────────────────────
  registerCustomer(payload: CustomerRegistration): Observable<any> {
    return this.http.post(`${this.baseUrl}/integrations/customers`, payload, {
      headers: this.getHeaders(),
    });
  }

  // ─────────────────────────────────────────────
  // Send a named event with metadata
  // POST /integrations/events
  // ─────────────────────────────────────────────
  sendEvent(payload: EventPayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/integrations/events`, payload, {
      headers: this.getHeaders(),
    });
  }

  // ─────────────────────────────────────────────
  // Redeem points for redemption section
  // ─────────────────────────────────────────────
  redeemPoints(
    customerId: string,
    points: number,
    transactionId: string,
  ): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/integrations/transactions/redeem`,
      {
        customerId,
        transactionId,
        transactionTime: new Date().toISOString(),
        points,
        ignoreOTP: true,
      },
      { headers: this.getHeaders() },
    );
  }

  // ─────────────────────────────────────────────
  // Place an order (earn + redeem)
  // POST /integrations/orders
  // ─────────────────────────────────────────────
  placeOrder(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/integrations/orders`, payload, {
      headers: this.getHeaders(),
    });
  }

  // ─────────────────────────────────────────────
  // Get customer points balance
  // GET /integrations/customers/{customerId}/balance
  // ─────────────────────────────────────────────
  getCustomerBalance(customerId: string): Observable<BalanceResponse> {
    return this.http.get<BalanceResponse>(
      `${this.baseUrl}/integrations/customers/${customerId}/balance`,
      { headers: this.getHeaders() },
    );
  }

  // ─────────────────────────────────────────────
  // Get customer VIP tier
  // GET /integrations/customers/{customerId}/tier-progress
  // ─────────────────────────────────────────────
  getCustomerTier(customerId: string): Observable<TierResponse> {
    return this.http.get<TierResponse>(
      `${this.baseUrl}/integrations/customers/${customerId}/tier-progress`,
      { headers: this.getHeaders() },
    );
  }

  // ─────────────────────────────────────────────
  // Get badge progress + campaign config in one call
  // GET /integrations/customers/{customerId}/reward-campaigns-progress
  // Note: singular "reward" not "rewards" — typo in earlier attempts
  // Response includes full campaign config + per-customer progress
  // Falls back to definitions-only if customer has no activity yet
  // ─────────────────────────────────────────────
  getBadgesProgress(customerId: string): Observable<BadgeProgress[]> {
    return forkJoin({
      definitions: this.getCampaignDefinitionsFallback(customerId).pipe(
        catchError(() => of([] as BadgeProgress[])),
      ),
      progress: this.http
        .get<
          CampaignProgress[]
        >(`${this.baseUrl}/integrations/customers/${customerId}/reward-campaigns-progress`, { headers: this.getHeaders() })
        .pipe(catchError(() => of([] as CampaignProgress[]))),
    }).pipe(
      map(({ definitions, progress }) => {
        // Build a map of campaign IDs that have progress
        const progressMap = new Map(
          progress.map((p) => [p.rewardsCampaignId, p]),
        );

        // Start with all campaigns that have progress data
        // Show these regardless of visibility — customer already has activity on them
        const campaignsWithProgress: BadgeProgress[] = progress
          .filter((p) => p.rewardCampaignConfiguration?.name?.trim() !== '')
          .map(
            (p) =>
              ({
                id: p.rewardsCampaignId,
                name:
                  p.rewardCampaignConfiguration?.name ?? p.rewardsCampaignName,
                description: p.rewardCampaignConfiguration?.description ?? '',
                icon: p.rewardCampaignConfiguration?.icon ?? null,
                type: p.rewardCampaignConfiguration?.type ?? '',
                visibility: p.rewardCampaignConfiguration?.visibility ?? '',
                rewards: p.rewardCampaignConfiguration?.rewards ?? [],
                completionPercentage: p.completionPercentage,
                achievedCount: p.achievedCount,
                isAchieved: p.achievedCount > 0,
                canAchieve: p.canAchieve,
              }) as BadgeProgress,
          );

        // Add visible campaigns that have NO progress yet (0% — not started)
        const campaignsWithoutProgress: BadgeProgress[] = definitions.filter(
          (d) => !progressMap.has(d.id),
        ); // only those not already in progress

        // Merge: progress campaigns first, then unstarted visible ones
        const allCampaigns = [
          ...campaignsWithProgress,
          ...campaignsWithoutProgress,
        ];

        // Sort: achieved first, then in-progress, then not started
        return allCampaigns.sort((a, b) => {
          if (a.isAchieved && !b.isAchieved) return -1;
          if (!a.isAchieved && b.isAchieved) return 1;
          return b.completionPercentage - a.completionPercentage;
        });
      }),
    );
  }

  // Fallback: show campaign definitions with 0% progress
  // Used when customer has no activity on any campaign yet
  private getCampaignDefinitionsFallback(
    customerId: string,
  ): Observable<BadgeProgress[]> {
    return this.http
      .get<
        CampaignDefinition[]
      >(`${this.baseUrl}/integrations/configurations/reward-campaigns?customerId=${customerId}`, { headers: this.getHeaders() })
      .pipe(
        map((campaigns: CampaignDefinition[]) =>
          campaigns
            .filter(
              (c) => c.name?.trim() !== '' && c.visibility !== 'Not Visible',
            )
            .map(
              (c) =>
                ({
                  id: c.id,
                  name: c.name,
                  description: c.description ?? '',
                  icon: c.icon,
                  type: c.type,
                  visibility: c.visibility,
                  rewards: c.rewards,
                  completionPercentage: 0,
                  achievedCount: 0,
                  isAchieved: false,
                  canAchieve: true,
                }) as BadgeProgress,
            ),
        ),
        catchError(() => of([] as BadgeProgress[])),
      );
  }
  // Get Customer Profile (for profile completion event)
  getCustomerProfile(customerId: string): Observable<any> {
    return this.http.get(
      `${this.baseUrl}/integrations/customers/${customerId}/details`,
      { headers: this.getHeaders() },
    );
  }
}
