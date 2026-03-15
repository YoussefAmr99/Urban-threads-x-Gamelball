import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameballService } from '../../services/gameball.service';
import { SessionService } from '../../services/session.service';

interface MockReview {
  author: string;
  rating: number;
  text: string;
  hasImage: boolean;
  date: string;
}

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss'],
})
export class ProductComponent implements OnInit {
  // Mock product data — no DB needed
  product = {
    id: 'PROD-001',
    sku: 'UBJ-BLK-M',
    name: 'Urban Bomber Jacket',
    price: 199.99,
    description:
      'A sleek, modern bomber jacket crafted from premium materials. Perfect for city life. Features a slim fit, ribbed cuffs, and a subtle UrbanThreads emblem on the left chest.',
    rating: 4.3,
    reviewCount: 127,
    image: '🧥',
  };

  reviewForm = {
    rating: 0,
    text: '',
    hasImage: false,
    imageFileName: '',
  };

  hoveredStar = 0;
  loading = false;
  reviewSubmitted = false;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null = null;

  // Mocked existing reviews
  reviews: MockReview[] = [
    {
      author: 'Sara M.',
      rating: 5,
      text: 'Absolutely love this jacket. Fits perfectly and looks amazing.',
      hasImage: true,
      date: 'Jan 12, 2026',
    },
    {
      author: 'James K.',
      rating: 4,
      text: 'Great quality, runs slightly large. Size down.',
      hasImage: false,
      date: 'Feb 3, 2026',
    },
    {
      author: 'Nour A.',
      rating: 5,
      text: "Best purchase I've made this year. Ultra comfortable.",
      hasImage: true,
      date: 'Feb 28, 2026',
    },
  ];

  constructor(
    private gameball: GameballService,
    public session: SessionService,
    public router: Router,
  ) {}

  ngOnInit(): void {
    if (!this.session.isLoggedIn()) {
      this.router.navigate(['/signup']);
    }
  }

  setRating(star: number): void {
    this.reviewForm.rating = star;
  }

  onImageToggle(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.reviewForm.hasImage = input.checked;
    this.reviewForm.imageFileName = input.checked ? 'my-photo.jpg' : '';
  }

  // ─────────────────────────────────────────────
  // Send write_review event
  // The has_image boolean in metadata is what
  // distinguishes image vs no-image reviews —
  // Gameball can award different points per type
  // ─────────────────────────────────────────────
  onSubmitReview(): void {
    if (this.reviewForm.rating === 0) {
      this.showToast('Please select a star rating.', 'error');
      return;
    }
    if (!this.reviewForm.text.trim()) {
      this.showToast('Please write a review.', 'error');
      return;
    }

    const user = this.session.getUser()!;
    this.loading = true;

    this.gameball
      .sendEvent({
        customerId: user.customerId,
        events: {
          write_review: {
            product_id: this.product.id,
            product_name: this.product.name,
            rating: this.reviewForm.rating,
            has_image: this.reviewForm.hasImage,
            review_text: this.reviewForm.text,
          },
        },
      })
      .subscribe({
        next: () => {
          // Add review to local list (no DB)
          this.reviews.unshift({
            author: user.displayName,
            rating: this.reviewForm.rating,
            text: this.reviewForm.text,
            hasImage: this.reviewForm.hasImage,
            date: new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
          });

          this.loading = false;
          this.reviewSubmitted = true;
          this.reviewForm = {
            rating: 0,
            text: '',
            hasImage: false,
            imageFileName: '',
          };

          const msg = this.reviewForm.hasImage
            ? 'Review submitted with photo! 📸'
            : 'Review submitted! 🎉';
          this.showToast(msg, 'success');
        },
        error: (err) => {
          this.loading = false;
          console.error('Event error:', err);
          this.showToast('Failed to submit review. Check API keys.', 'error');
        },
      });
  }

  get starsArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    this.toast = { message, type };
    setTimeout(() => (this.toast = null), 3500);
  }
}
