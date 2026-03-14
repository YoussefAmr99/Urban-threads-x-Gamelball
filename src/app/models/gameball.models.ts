// ─────────────────────────────────────────────
// REQUEST MODELS
// ─────────────────────────────────────────────

export interface CustomerAttributes {
  displayName: string;
  email: string;
  mobile?: string;
  gender?: 'M' | 'F';
  dateOfBirth?: string; // ISO 8601
}

export interface CustomerRegistration {
  customerId: string;
  customerAttributes: CustomerAttributes;
}

export interface EventPayload {
  customerId: string;
  events: Record<string, Record<string, any>>;
}

export interface LineItem {
  productId: string;
  title: string;
  quantity: number;
  price: number;
  sku?: string;
}

export interface OrderPayload {
  customerId: string;
  orderId: string;
  orderDate: string;
  totalPaid: number;
  totalPrice: number;
  totalDiscount?: number;
  redeemedPoints?: number;
  lineItems: LineItem[];
}

// ─────────────────────────────────────────────
// RESPONSE MODELS
// ─────────────────────────────────────────────

export interface BalanceResponse {
  totalPointsBalance: number;
  totalPointsValue: number;
  avaliablePointsBalance: number; // Gameball's spelling (typo in their API)
  avaliablePointsValue: number;
  pendingPoints: number;
  pendingPointsValue: number;
  currency: string;
  pointsName: string;
  nextExpiringPointsAmount: number | null;
  nextExpiringPointsValue: number | null;
  nextExpiringPointsDate: string | null;
  totalEarnedPoints: number;
  totalEarnedPendingPoints: number;
}

export interface TierState {
  name: string;
  icon?: string;
  order: number;
  minProgress: number;
}

export interface TierResponse {
  current: TierState;
  next?: TierState;
  progress: number;
}

export interface BadgeReward {
  walletReward: number;
  rankReward: number;
  couponReward: string | null;
}

// From /configurations/reward-campaigns
export interface CampaignDefinition {
  id: number;
  name: string;
  internalName: string;
  description: string;
  icon: string | null;
  isActive: boolean;
  isRepeatable: boolean;
  maxAchievement: number;
  type: string;
  visibility: string;
  rewards: BadgeReward[];
}

// From /customers/{id}/rewards-campaigns-progress
export interface CampaignProgress {
  rewardsCampaignId: number;
  rewardsCampaignName: string;
  completionPercentage: number;
  achievedCount: number;
}

// Merged model used in the UI
export interface BadgeProgress {
  id: number;
  name: string;
  description: string;
  icon: string | null;
  type: string;
  rewards: BadgeReward[];
  completionPercentage: number;
  achievedCount: number;
  isAchieved: boolean;
}

// ─────────────────────────────────────────────
// SESSION (local state — no DB)
// ─────────────────────────────────────────────

export interface SessionUser {
  customerId: string;
  displayName: string;
  email: string;
  mobile?: string;
  gender?: 'M' | 'F';
  dateOfBirth?: string;
  profileCompleted: boolean;
}
