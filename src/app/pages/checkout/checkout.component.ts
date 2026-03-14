import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameballService } from '../../services/gameball.service';
import { SessionService } from '../../services/session.service';
import { BalanceResponse } from '../../models/gameball.models';

interface CartItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  sku: string;
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
})
export class CheckoutComponent implements OnInit {
  // ─── Mocked cart — no DB needed ───
  cart: CartItem[] = [
    {
      productId: 'PROD-001',
      title: 'Urban Bomber Jacket',
      price: 199.99,
      quantity: 1,
      sku: 'UBJ-BLK-M',
    },
    {
      productId: 'PROD-002',
      title: 'Classic White Tee',
      price: 39.99,
      quantity: 2,
      sku: 'CWT-WHT-L',
    },
  ];

  // ─── Points redemption state ───
  balance: BalanceResponse | null = null;
  pointsToRedeem = 0;
  maxRedeemablePoints = 0;
  loadingBalance = true;

  // ─── Order state ───
  loading = false;
  orderPlaced = false;
  orderId = '';
  pointsEarned = 0;

  toast: { message: string; type: 'success' | 'error' | 'info' } | null = null;

  constructor(
    private gameball: GameballService,
    public session: SessionService,
    public router: Router,
  ) {}

  ngOnInit(): void {
    if (!this.session.isLoggedIn()) {
      this.router.navigate(['/signup']);
      return;
    }
    this.loadBalance();
  }

  // ─────────────────────────────────────────────
  // TASK 3b: Load customer balance
  // Shown BEFORE checkout so customer can decide
  // how many points to redeem
  // ─────────────────────────────────────────────
  loadBalance(): void {
    const customerId = this.session.getUser()!.customerId;
    this.loadingBalance = true;

    this.gameball.getCustomerBalance(customerId).subscribe({
      next: (balance) => {
        this.balance = balance;
        // Cap redeemable points at available balance
        // and also cap at order total value (can't redeem more than you owe)
        this.maxRedeemablePoints = Math.min(
          balance.avaliablePointsBalance,
          this.pointsEquivalentOfTotal,
        );
        this.loadingBalance = false;
      },
      error: (err) => {
        console.error('Balance fetch error:', err);
        this.loadingBalance = false;
        this.showToast('Could not load points balance.', 'error');
      },
    });
  }

  // ─────────────────────────────────────────────
  // TASK 3: Place order
  // If pointsToRedeem > 0 → earning + redemption
  // If pointsToRedeem === 0 → earning only
  // Both handled by POST /orders in one call
  // ─────────────────────────────────────────────
  onPlaceOrder(): void {
    const user = this.session.getUser()!;
    this.loading = true;

    // Generate a unique order ID
    const orderId = `ORD-${Date.now()}`;
    const orderDate = new Date().toISOString();

    const payload: any = {
      customerId: user.customerId,
      orderId,
      orderDate,
      totalPrice: this.subtotal,
      totalPaid: this.totalAfterRedemption,
      totalDiscount: this.redemptionDiscount,
      lineItems: this.cart.map((item) => ({
        productId: item.productId,
        title: item.title,
        quantity: item.quantity,
        price: item.price,
        sku: item.sku,
      })),
    };

    // Only include redeemedPoints if customer actually redeems
    if (this.pointsToRedeem > 0) {
      payload.redeemedPoints = this.pointsToRedeem;
    }

    this.gameball.placeOrder(payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.orderPlaced = true;
        this.orderId = orderId;
        // Estimate earned points — in reality Gameball returns this
        // based on configured earning rules in the dashboard
        this.pointsEarned = Math.floor(this.totalAfterRedemption);
      },
      error: (err) => {
        this.loading = false;
        console.error('Order error:', err);
        this.showToast('Order failed. Check your API keys.', 'error');
      },
    });
  }

  // ─────────────────────────────────────────────
  // COMPUTED VALUES
  // ─────────────────────────────────────────────
  get subtotal(): number {
    return this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  get redemptionDiscount(): number {
    if (!this.balance || this.pointsToRedeem === 0) return 0;
    // Calculate monetary value of redeemed points proportionally
    const pointsValue = this.balance.avaliablePointsValue || 0;
    const totalPoints = this.balance.avaliablePointsBalance || 1;
    return parseFloat(
      ((this.pointsToRedeem / totalPoints) * pointsValue).toFixed(2),
    );
  }

  get totalAfterRedemption(): number {
    return parseFloat(
      Math.max(0, this.subtotal - this.redemptionDiscount).toFixed(2),
    );
  }

  // How many points equal the full order total
  // (used to cap max redeemable)
  get pointsEquivalentOfTotal(): number {
    if (!this.balance || !this.balance.avaliablePointsValue) return 0;
    const totalPoints = this.balance.avaliablePointsBalance || 1;
    const pointsValue = this.balance.avaliablePointsValue;
    return Math.floor((this.subtotal / pointsValue) * totalPoints);
  }

  onPointsSliderChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.pointsToRedeem = parseInt(input.value, 10);
  }

  clearRedemption(): void {
    this.pointsToRedeem = 0;
  }

  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    this.toast = { message, type };
    setTimeout(() => (this.toast = null), 3500);
  }
}
