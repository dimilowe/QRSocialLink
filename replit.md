# QR Social

A social QR code scanning platform built with Next.js, Neon PostgreSQL, and Stripe.

## Overview
QR Social is a full-stack web application that allows users to scan QR codes, share them on a social feed, and interact with other users' scans. The platform includes a freemium model with Pro subscriptions.

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Wouter (routing), TanStack Query, Shadcn UI
- **Backend**: Express.js, Node.js, Passport.js (authentication)
- **Database**: Neon PostgreSQL with Drizzle ORM
- **Payments**: Stripe (subscription management)
- **QR Scanning**: html5-qrcode (camera), jsqr (image upload), qrcode (generation)

## Features Implemented

### Authentication & User Management
- Email/password signup and login via Passport.js
- User profiles with username, email, and avatar
- Session-based authentication
- Protected routes

### QR Code Scanning & Creation
- Camera-based QR scanning using html5-qrcode
- Image upload QR detection with jsqr
- Automatic redirect to decoded URLs
- QR code generation and storage
- Scan history per user
- **Branded QR Code Creation**: Users can create custom QR codes with:
  - Purple branded borders (matching QR Social's primary color #9333EA)
  - "qrsocial.com" branding text at top
  - "long-press to open" instructions at bottom
  - "Made with QR Social" watermark in bottom right corner (subtle self-advertising)
  - Customizable QR colors (foreground/background)
  - Optional title field
  - Real-time preview
  - Auto-post to social feed

### Social Feed
- Public feed showing recent scans from all users
- Scan cards with user info, QR thumbnail, and decoded link
- Like/unlike functionality
- Comment system
- Follow/unfollow users
- Tap-to-rescan feature (opens decoded link)

### User Profiles
- Profile header with avatar and stats (scans, followers, following)
- Scan history grid with thumbnails
- Free tier: last 10 scans
- Pro tier: unlimited history
- Logout functionality

### 4-Tier Subscription Model
QR Social offers a freemium model with 4 pricing tiers:

**Free** - $0/month:
- 1 static QR code
- Public feed access
- Like & comment features
- Follow users

**Starter** - $10/month:
- 20 editable QR codes
- Edit QR destinations anytime
- Basic analytics
- Scan tracking
- All Free features

**Pro** - $30/month (Most Popular):
- 50 editable QR codes
- Advanced analytics
- Custom QR colors
- Priority support
- All Starter features

**Unlimited** - $99/month:
- Unlimited QR codes
- Custom branding
- Full analytics dashboard
- Team collaboration
- Dedicated support
- All Pro features

Implementation:
- Multi-tier upgrade modal with plan comparison
- Stripe checkout integration with plan parameter
- Dynamic subscription updates (upgrade/downgrade)
- Webhook-based plan management
- Backend enforcement of tier limits

### Design System
- Dark mode by default with light mode toggle
- Purple primary color (270 70% 60%)
- Inter font for body, Space Grotesk for headings
- Responsive layout (mobile-first)
- Top header navigation
- Bottom navigation for mobile
- Floating scan button
- Loading states and error handling

## Database Schema

### Tables
- **users**: id, email, username, password, avatarUrl, plan, stripeCustomerId, stripeSubscriptionId
- **scans**: id, userId, qrImageUrl, decodedUrl, title, type, redirectUrl, isPublic, campaignId, dynamicSlug
  - `type` field: "scanned" (default) or "created" to distinguish scan vs creation
  - `campaignId`: optional link to campaign for marketing QRs
  - `dynamicSlug`: short slug for dynamic redirect URLs
- **followers**: id, followerId, followedId
- **likes**: id, userId, scanId
- **comments**: id, userId, scanId, content
- **qr_drops**: id, creatorId, qrImageUrl, decodedUrl, title, activeUntil, scanCount, maxScans (future feature)
- **campaigns**: id, userId, name, slug, abStrategy, status, createdAt, updatedAt
  - Groups multiple QR codes with shared A/B testing strategy
- **destinations**: id, campaignId, name, url, weight, impressions, conversions, isActive
  - A/B test variants with automatic performance tracking
- **frames**: id, userId, name, fileUrl, safeAreaX, safeAreaY, safeAreaWidth, safeAreaHeight, aspectRatio
  - Video/image overlays with defined safe areas for QR placement
- **overlayRenditions**: id, userId, scanId, frameId, status, outputUrl, createdAt, completedAt
  - FFmpeg rendering jobs for QR + frame composites
- **scanEvents**: id, campaignId, destinationId, scanId, userAgent, ipHash, referrer, country, platform, timestamp
  - Detailed analytics tracking with privacy-friendly IP hashing

## API Endpoints

### Authentication
- POST `/api/register` - Create new account
- POST `/api/login` - Login
- POST `/api/logout` - Logout
- GET `/api/user` - Get current user

### Scans
- GET `/api/feed` - Get public feed
- POST `/api/scans` - Create new scan
- GET `/api/users/:id/scans` - Get user's scans
- PATCH `/api/scans/:id` - Update QR code (Starter+ plan required)

### Social
- POST `/api/users/:id/follow` - Follow user
- POST `/api/users/:id/unfollow` - Unfollow user
- GET `/api/following` - Get users you follow
- POST `/api/scans/:id/like` - Like/unlike scan
- GET `/api/scans/:id/comments` - Get scan comments
- POST `/api/scans/:id/comments` - Add comment

### User Info
- GET `/api/users/:id` - Get user profile
- GET `/api/users/:id/stats` - Get user stats (scans, followers, following)

### Subscription
- POST `/api/get-or-create-subscription` - Create or retrieve Stripe subscription
- POST `/api/webhooks/stripe` - Stripe webhook endpoint for subscription events

### Campaigns & A/B Testing
- POST `/api/campaigns` - Create new campaign
- GET `/api/campaigns` - Get user's campaigns
- GET `/api/campaigns/:id` - Get campaign with destinations and analytics
- PATCH `/api/campaigns/:id` - Update campaign
- DELETE `/api/campaigns/:id` - Delete campaign
- POST `/api/campaigns/:campaignId/destinations` - Add A/B test variant
- PATCH `/api/destinations/:id` - Update destination
- DELETE `/api/destinations/:id` - Delete destination
- GET `/r/:slug` - Dynamic redirect with A/B testing (public)
- POST `/api/events/conversion` - Record conversion event (public)

## Environment Variables Required
- `DATABASE_URL` - Neon PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `VITE_STRIPE_PUBLIC_KEY` - Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (for webhook signature verification)

## Recent Changes (November 2025)
- Initial MVP implementation completed
- All core features functional
- Stripe subscription flow integrated with webhook handling
- Webhook endpoint processes subscription events (invoice.paid, subscription.updated, subscription.deleted)
- Automatic plan updates based on subscription status
- Backend enforcement of tier limits
- Fixed Stripe API version and tier enforcement
- **Migrated from Supabase to Neon PostgreSQL** - Resolved SSL certificate issues by switching to Neon database with proven neon-serverless driver configuration
- Database schema deployed to Neon
- Theme toggle system implemented
- Responsive design with mobile navigation
- **QR Code Creator feature launched** (Phase 3):
  - New /create route with dedicated creator page
  - Canvas-based branded QR generation with purple borders
  - QR Social branding ("qrsocial.com" + "long-press to open")
  - Color customization (foreground/background)
  - Real-time preview with title support
  - Created QRs auto-post to feed with "Created" badge
  - Bottom navigation updated (Home, Create, Activity, Profile)
  - Desktop navigation in top header (Feed, Create, Activity)
- **4-Tier Subscription Pricing Implemented** (November 2025):
  - Replaced Free/Pro ($15) with Free/Starter ($10)/Pro ($30)/Unlimited ($99)
  - Added PLAN_TIERS and PLAN_LIMITS to shared/schema.ts
  - Updated backend to handle plan changes (upgrades/downgrades)
  - Subscription update API supports plan changes with proration
  - Same-plan selections return immediate success
  - Downgrades handled via credit invoices (no payment required)
  - Upgrades require payment confirmation
  - Pricing modal shows all 4 tiers in responsive grid
  - Subscribe page handles plan parameter and all flow types
  - Webhook stores and reads planTier from subscription metadata
- **QR Code Download Functionality** (November 2025):
  - Download button on QR creator page (/create) below preview
  - Download button on each dashboard QR card alongside Edit button
  - Download button in dashboard edit modal preview section
  - Downloads as PNG files with descriptive filenames (includes title or ID)
  - Uses anchor element with download attribute for cross-browser compatibility
  - All downloaded QR codes include "Made with QR Social" watermark for self-promotion
- **Campaign Management & A/B Testing Infrastructure** (November 2025):
  - Extended database with 5 new tables: campaigns, destinations, frames, overlayRenditions, scanEvents
  - Installed FFmpeg system dependency for future video overlay rendering
  - Added packages: sharp (image processing), multer (file uploads), nanoid (slug generation)
  - Implemented Campaign CRUD API with authentication and ownership checks
  - Built A/B testing service with two strategies:
    - WeightedRandomStrategy: Distributes traffic by configured weight
    - EpsilonGreedyStrategy: Multi-armed bandit algorithm for automatic optimization
  - Dynamic redirect system (/r/:slug) selects A/B variant and tracks impressions
  - Scan event logging with privacy-friendly IP hashing (salted SHA-256)
  - Conversion tracking API for measuring A/B test performance
  - All campaign endpoints enforce authentication and user ownership
  - Backend ready for frame overlays and advanced analytics UI

## Stripe Webhook Configuration
To enable automatic subscription management:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint URL: `https://your-replit-url.replit.app/api/webhooks/stripe`
3. Select events to listen for:
   - `invoice.paid` - Upgrades user to Pro when payment succeeds
   - `customer.subscription.updated` - Updates plan based on subscription status
   - `customer.subscription.deleted` - Downgrades user to Free when subscription cancelled
   - `invoice.payment_failed` - Logs payment failures
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` environment variable

## User Preferences

### Database Configuration
**Always use Neon PostgreSQL** for future builds with this proven configuration:

```typescript
// db/index.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
export const db = drizzle({ client: pool, schema });
```

**Key Configuration Points:**
- Use `@neondatabase/serverless` package (Pool, neonConfig)
- Set `neonConfig.webSocketConstructor = ws` before pool initialization
- Configure SSL with `rejectUnauthorized: false` to avoid certificate errors
- Use `drizzle-orm/neon-serverless` adapter

This configuration has been battle-tested and resolves SSL certificate issues that can occur with other PostgreSQL setups.

## Known Limitations / Future Enhancements
- QR Drops feature UI created but backend not fully implemented
- Analytics dashboard not yet built
- No real-time feed updates (polling only)
- Avatar upload not yet implemented (using default avatars)
- Rescan/repost functionality not implemented
- QR code analytics (scan count tracking) not implemented
