import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
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
  // TASK 1: Register / update a customer in Gameball
  // POST /integrations/customers
  // ─────────────────────────────────────────────
  registerCustomer(payload: CustomerRegistration): Observable<any> {
    return this.http.post(`${this.baseUrl}/integrations/customers`, payload, {
      headers: this.getHeaders(),
    });
  }

  // ─────────────────────────────────────────────
  // TASK 2: Send a named event with metadata
  // POST /integrations/events
  // ─────────────────────────────────────────────
  sendEvent(payload: EventPayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/integrations/events`, payload, {
      headers: this.getHeaders(),
    });
  }

  // ─────────────────────────────────────────────
  // TASK 3 STEP 1: Hold points before redemption
  // POST /v3.0/integrations/transaction/hold
  // Note: transactions API uses v3.0, requires playerUniqueId
  // ─────────────────────────────────────────────
  holdPoints(customerId: string, pointsToHold: number): Observable<any> {
    return this.http.post(
      `https://api.gameball.co/api/v3.0/integrations/transaction/hold`,
      {
        playerUniqueId: customerId,
        amount: pointsToHold,
        transactionTime: new Date().toISOString(),
      },
      { headers: this.getHeaders() },
    );
  }

  // ─────────────────────────────────────────────
  // TASK 3 STEP 2: Place an order (earn + optionally redeem)
  // POST /integrations/orders
  // ─────────────────────────────────────────────
  placeOrder(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/integrations/orders`, payload, {
      headers: this.getHeaders(),
    });
  }

  // ─────────────────────────────────────────────
  // TASK 3b + TASK 4: Get customer points balance
  // GET /integrations/customers/{customerId}/balance
  // ─────────────────────────────────────────────
  getCustomerBalance(customerId: string): Observable<BalanceResponse> {
    return this.http.get<BalanceResponse>(
      `${this.baseUrl}/integrations/customers/${customerId}/balance`,
      { headers: this.getHeaders() },
    );
  }

  // ─────────────────────────────────────────────
  // TASK 4: Get customer VIP tier and progress
  // GET /integrations/customers/{customerId}/tier-progress
  // ─────────────────────────────────────────────
  getCustomerTier(customerId: string): Observable<TierResponse> {
    return this.http.get<TierResponse>(
      `${this.baseUrl}/integrations/customers/${customerId}/tier-progress`,
      { headers: this.getHeaders() },
    );
  }

  // ─────────────────────────────────────────────
  // TASK 4: Get campaign definitions (name, icon, rewards)
  // GET /integrations/configurations/reward-campaigns
  // Filtered to only visible campaigns with a name
  // ─────────────────────────────────────────────
  private getCampaignDefinitions(
    customerId: string,
  ): Observable<CampaignDefinition[]> {
    return this.http
      .get<
        CampaignDefinition[]
      >(`${this.baseUrl}/integrations/configurations/reward-campaigns?customerId=${customerId}`, { headers: this.getHeaders() })
      .pipe(
        // Filter here on CampaignDefinition where visibility field exists
        map((campaigns: CampaignDefinition[]) =>
          campaigns.filter(
            (c) => c.name?.trim() !== '' && c.visibility !== 'Not Visible',
          ),
        ),
      );
  }

  // ─────────────────────────────────────────────
  // TASK 4: Get per-customer campaign progress
  // GET /integrations/customers/{customerId}/rewards-campaigns-progress
  // Returns completionPercentage and achievedCount per campaign
  // ─────────────────────────────────────────────
  private getCampaignProgress(
    customerId: string,
  ): Observable<CampaignProgress[]> {
    return this.http.get<CampaignProgress[]>(
      `${this.baseUrl}/integrations/customers/${customerId}/rewards-campaigns-progress`,
      { headers: this.getHeaders() },
    );
  }

  // ─────────────────────────────────────────────
  // TASK 4: Merge definitions + progress into BadgeProgress[]
  // Calls both endpoints in parallel, merges by campaign ID
  // If progress endpoint 404s (new customer) → defaults to 0%
  // ─────────────────────────────────────────────
  getBadgesProgress(customerId: string): Observable<BadgeProgress[]> {
    return forkJoin({
      definitions: this.getCampaignDefinitions(customerId),
      progress: this.getCampaignProgress(customerId).pipe(
        catchError(() => of([] as CampaignProgress[])),
      ),
    }).pipe(
      map(({ definitions, progress }) =>
        definitions.map((def) => {
          const prog = progress.find((p) => p.rewardsCampaignId === def.id);
          const completionPercentage = prog?.completionPercentage ?? 0;
          return {
            id: def.id,
            name: def.name,
            description: def.description,
            icon: def.icon,
            type: def.type,
            rewards: def.rewards,
            completionPercentage,
            achievedCount: prog?.achievedCount ?? 0,
            isAchieved: completionPercentage >= 100,
          } as BadgeProgress;
        }),
      ),
    );
  }
}
