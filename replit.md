# QR Social

A social QR code scanning platform built with Next.js, Supabase, and Stripe.

## Overview
QR Social is a full-stack web application that allows users to scan QR codes, share them on a social feed, and interact with other users' scans. The platform includes a freemium model with Pro subscriptions.

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Wouter (routing), TanStack Query, Shadcn UI
- **Backend**: Express.js, Node.js, Passport.js (authentication)
- **Database**: Supabase PostgreSQL with Drizzle ORM
- **Payments**: Stripe (subscription management)
- **QR Scanning**: html5-qrcode (camera), jsqr (image upload), qrcode (generation)

## Features Implemented

### Authentication & User Management
- Email/password signup and login via Passport.js
- User profiles with username, email, and avatar
- Session-based authentication
- Protected routes

### QR Code Scanning
- Camera-based QR scanning using html5-qrcode
- Image upload QR detection with jsqr
- Automatic redirect to decoded URLs
- QR code generation and storage
- Scan history per user

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
- **scans**: id, userId, qrImageUrl, decodedUrl, title, isPublic
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
- `DATABASE_URL` - Supabase PostgreSQL connection string
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
- Database schema deployed to Supabase
- Theme toggle system implemented
- Responsive design with mobile navigation

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

## Known Limitations / Future Enhancements
- QR Drops feature UI created but backend not fully implemented
- Analytics dashboard not yet built
- Branded QR skins not implemented
- No real-time feed updates (polling only)
- Avatar upload not yet implemented (using default avatars)
- Dynamic QR URL updates not implemented
- Rescan/repost functionality not implemented
