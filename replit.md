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

### Freemium / Pro Subscription
- Free tier: unlimited scans, limited history (10 scans), public feed access
- Pro tier: $15/month via Stripe
  - Unlimited scan history
  - Future: Dynamic QRs, analytics, branded skins, unlimited QR drops
- Pro upgrade modal with feature comparison
- Stripe checkout integration
- Subscription management

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
- **scans**: id, userId, qrImageUrl, decodedUrl, title, type, redirectUrl, isPublic
  - `type` field: "scanned" (default) or "created" to distinguish scan vs creation
- **followers**: id, followerId, followedId
- **likes**: id, userId, scanId
- **comments**: id, userId, scanId, content
- **qr_drops**: id, creatorId, qrImageUrl, decodedUrl, title, activeUntil, scanCount, maxScans (future feature)

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

## Environment Variables Required
- `DATABASE_URL` - Neon PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `VITE_STRIPE_PUBLIC_KEY` - Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (for webhook signature verification)

## Recent Changes (October 2025)
- Initial MVP implementation completed
- All core features functional
- Stripe subscription flow integrated with webhook handling
- Webhook endpoint processes subscription events (invoice.paid, subscription.updated, subscription.deleted)
- Automatic plan updates based on subscription status
- Backend enforcement of free tier 10-scan limit
- Fixed Stripe API version and free tier enforcement
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
- Download QR code option not yet implemented
- QR code analytics (scan count tracking) not implemented
