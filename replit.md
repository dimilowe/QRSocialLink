# QR Social

## Overview
QR Social is a full-stack web application designed as a marketing analytics platform for QR codes. It enables users to create custom-branded QR codes, implement A/B testing for various destinations, and meticulously track comprehensive analytics. The platform supports detailed tracking of device types, social media traffic sources (like TikTok, Instagram, YouTube), operating system and browser data, and virality trends. It operates on a preview-only free model with a 3-tier paid subscription system (Starter, Pro, Unlimited). Users can build and preview QR codes for free but need a paid subscription to save or download. The business vision is to provide a robust tool for marketers to optimize QR code campaigns, understand user engagement, and drive conversions effectively.

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

## System Architecture

**UI/UX Decisions:**
- **Design System**: Dark mode by default with a light mode toggle, purple primary color (270 70% 60%), Inter font for body, Space Grotesk for headings.
- **Layout**: Responsive (mobile-first) with a top header navigation and a bottom navigation for mobile.
- **Branding**: Custom QR codes include purple borders, "qrsocial.com" branding, "long-press to open" instructions, and a "Made with QR Social" watermark.
- **Workflow**: Marketing-focused home page for logged-in users, dedicated QR creation page with real-time preview, and intuitive navigation for campaigns and QR codes.

**Technical Implementations:**
- **Frontend**: React, TypeScript, Tailwind CSS, Wouter (routing), TanStack Query, Shadcn UI.
- **Backend**: Express.js, Node.js, Passport.js (authentication).
- **Database ORM**: Drizzle ORM.
- **QR Code Handling**: `html5-qrcode` for camera scanning, `jsqr` for image upload, `qrcode` for generation, `gifler` for animated GIF backgrounds.
- **A/B Testing**: Implemented with `WeightedRandomStrategy` and `EpsilonGreedyStrategy` (multi-armed bandit algorithm).
- **Analytics**: Detailed scan event logging with privacy-friendly IP hashing, user agent parsing (UAParser) for device, OS, browser, and platform detection.
- **Subscription Management**: Stripe integration for multi-tier subscriptions with webhook-based plan management.
- **Image Processing**: `sharp` for image manipulation and `multer` for file uploads.
- **Dynamic Redirects**: Short slugs for dynamic QR code URLs `/r/:slug`.

**Feature Specifications:**
- **Authentication**: Email/password via Passport.js, session-based with protected routes.
- **QR Code Management**: Custom branded QR code creation with color customization, background images (static and animated GIFs), image fit modes (cover/contain/stretch), real-time preview with animated GIF playback, download as PNG/GIF (animated), storage, and history. Editable destinations for paid plans.
  - **Scan Tracking**: Individual QR codes use `/q/:slug` tracking URLs (generated with nanoid). After saving, QR codes are automatically regenerated with tracking URLs while preserving all custom branding (shapes, colors, GIFs, text, watermarks). The `generateBrandedQR()` function is fully self-contained and reusable across preview and tracking regeneration flows.
- **Subscription Model**: Preview-only free access + 3 paid tiers (Starter $10/mo, Pro $30/mo, Unlimited $99/mo). Free users can build and preview QR codes but cannot save or download. Feature-based limits (canSave, canDownload) enforced by the backend, integrated with Stripe checkout and dynamic updates via webhooks.
- **Campaigns & A/B Testing**: CRUD operations for campaigns, creation of A/B test variants (destinations) with weight configuration, impression, and conversion tracking.
- **Advanced Analytics**: 
  - **Campaign Analytics**: Comprehensive tracking for campaigns including device types, social media sources, OS/browser breakdown, and time-series data.
  - **Individual QR Analytics**: Each QR code displays real-time scan metrics on the dashboard including total scans, top traffic platform, device breakdown, OS data, and time-series trends via `/api/scans/:scanId/analytics` endpoint.
  - Detailed scan event logging with privacy-friendly IP hashing and user agent parsing (UAParser).
- **Download Functionality**: Download QR codes as static PNGs or animated GIFs from creator page, dashboard, and edit modals, including the "Made with QR Social" watermark.
- **Animated GIF Support**: 
  - Upload animated GIFs as QR code backgrounds with real-time preview using DOM layering (img tag + transparent QR overlay).
  - Backend FFmpeg processing overlays transparent QR code on each frame of animated GIF for download.
  - Supports image fit modes (cover/contain/stretch) with proper frame scaling.
- **Platform-Specific Overlay Generator**: 
  - Create social media-optimized overlay frames that nest QR codes within platform templates (TikTok, YouTube Shorts, Instagram Reels).
  - Platform presets with accurate safe zones: TikTok (131px top, 367px bottom), Instagram Reels, YouTube Shorts (all 1080x1920, 9:16 aspect ratio).
  - Customizable CTA text (max 120 characters) for maximum engagement.
  - Authenticated overlay endpoints with Zod validation for data integrity.
  - Database schema: overlayRenditions table stores generated overlays with status tracking, frames table holds template metadata.
  - API endpoints: GET /api/overlay-templates (requires auth), POST /api/overlays/generate (validated with insertOverlayRenditionSchema), GET /api/overlays (user's overlay history).
  - Security: All endpoints require authentication, proper authorization (user owns QR code), input validation with max length enforcement.

## External Dependencies

- **Database**: Neon PostgreSQL (with `@neondatabase/serverless` and Drizzle ORM)
- **Payment Processing**: Stripe (for subscription management, checkout, and webhooks)
- **Authentication**: Passport.js
- **QR Code Libraries**: `html5-qrcode`, `jsqr`, `qrcode`
- **Image Processing**: `sharp`
- **File Uploads**: `multer`
- **Utility Libraries**: `nanoid` (for slug generation), `UAParser` (for user agent parsing)
- **FFmpeg**: System dependency (for future video overlay rendering)