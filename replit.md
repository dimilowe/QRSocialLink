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
- **Split Testing**: Implemented with weighted random strategy for manual traffic distribution.
- **Analytics**: Detailed scan event logging with privacy-friendly IP hashing, user agent parsing (UAParser) for device, OS, browser, and platform detection.
- **Subscription Management**: Stripe Checkout integration for multi-tier subscriptions with webhook-based plan management.
  - **Payment Flow**: Stripe Checkout hosted payment page (supports Apple Pay, Google Pay, and all major payment methods)
  - **Backend**: POST /api/create-checkout-session creates Checkout Sessions with userId and planTier metadata
  - **Webhook**: checkout.session.completed event activates subscriptions automatically after payment
  - **Success Page**: Polls /api/user endpoint until subscription activation is confirmed
  - **Production Setup**: Requires trust proxy configuration, secure cookies (secure:true, sameSite:lax) for HTTPS domains
  - **Webhook Events**: checkout.session.completed, invoice.paid, customer.subscription.updated, customer.subscription.deleted
- **Image Processing**: `sharp` for image manipulation and `multer` for file uploads.
- **Dynamic Redirects**: Short slugs for dynamic QR code URLs `/r/:slug`.

**Feature Specifications:**
- **Authentication**: Email/password via Passport.js, session-based with protected routes.
- **QR Code Management**: Custom branded QR code creation with color customization, background images (static and animated GIFs), image fit modes (cover/contain/stretch), real-time preview with animated GIF playback, download as PNG/GIF (animated), storage, and history. Editable destinations for paid plans.
  - **Scan Tracking**: Individual QR codes use `/q/:slug` tracking URLs (generated with nanoid). After saving, QR codes are automatically regenerated with tracking URLs while preserving all custom branding (shapes, colors, GIFs, text, watermarks). The `generateBrandedQR()` function is fully self-contained and reusable across preview and tracking regeneration flows.
- **Subscription Model**: Preview-only free access + 3 paid tiers (Starter $10/mo, Pro $30/mo, Unlimited $99/mo). Free users can build and preview QR codes but cannot save or download. Feature-based limits (canSave, canDownload) enforced by the backend, integrated with Stripe checkout and dynamic updates via webhooks.
- **Campaigns & Split Testing**: 
  - **Toggle-Based QR Modes**: QR codes can operate in two modes via a toggle in both create and edit interfaces:
    - **Simple Mode** (default): Direct URL tracking with `destination` field for straightforward redirects
    - **Split Testing Mode**: Campaign-based multi-variant testing with weighted distribution
  - **Mode Switching**: Edit modal supports converting between simple and split testing modes. When enabling split testing, the system clears `destination` AND `redirectUrl` to ensure clean campaign routing. When disabling split testing, the user must specify a destination URL.
  - **Backend Redirect Logic**: `/q/:slug` endpoint implements campaign-aware routing:
    - Priority order: campaign destinations (if `campaignId` set) → `destination` → `redirectUrl` → `decodedUrl`
    - Uses weighted random strategy for traffic distribution
    - Tracks `destinationId` in scan events and increments destination impressions
  - **Manual Split Testing**: Users manually adjust traffic weights based on impression counts. No auto-optimization or complex strategies.
  - **Campaign Detail UI**: Displays Total Scans, Weight, Impressions, and Traffic Share per destination. Conversion tracking UI removed - users only need impression data to make split testing decisions.
  - CRUD operations for campaigns, creation of split test variants (destinations) with weight configuration and impression tracking.
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
  - **Interactive Canva-Style Editor**:
    - Click-and-drag QR code repositioning with real-time preview on canvas overlay
    - Four corner resize handles with anchor-based logic (opposite corner stays fixed during resize)
    - Visual selection highlighting when QR code is active
    - Bidirectional synchronization between interactive drag/resize and slider controls
    - Performance-optimized with data caching (template JSON parsed once per gesture)
    - Coordinate translation between display scale and canvas dimensions for pixel-perfect positioning
    - Diagonal-based resize calculation ensures smooth handle tracking across all corners
    - Size normalization prevents jumps when resizing (uses actual rendered size as baseline)
    - **Percentage-Based QR Offset System**: QR positions stored as percentages of overlay dimensions (`qrOffsetPercent` as source of truth) to preserve relative positioning when switching platforms/aspect ratios. Central `updateQrOffset()` helper synchronizes percent and pixel state atomically. Pending-offsets mechanism ensures saved overlays hydrate correctly after frame/platform data loads.
    - **Banner Selection Fix**: Hit-testing uses canvas coordinates instead of mixing coordinate systems, preventing mismatches between cursor position and rendered geometry.
  - Authenticated overlay endpoints with Zod validation for data integrity.
  - Database schema: overlayRenditions table stores generated overlays with status tracking, frames table holds template metadata.
  - **Background Processing & Rendering**:
    - Asynchronous overlay generation via OverlayProcessor service (polls every 5 seconds)
    - Atomic job claiming prevents race conditions with multiple processor instances
    - ImageMagick-based rendering pipeline for static PNG overlays with rounded corners support
    - Composites: black background → rounded rectangle panel (borderRadius applied) → QR code → CTA text
    - QR scale bounds (50-800px) prevent OOM errors during resize operations
    - Supports both URL and base64 QR images (fetches remote URLs to temp files)
    - Status workflow: queued → rendering → completed/failed with error tracking
    - Temp file cleanup ensures no disk space leaks
    - Generated overlays saved to server/output/overlays/{renditionId}.png
  - **Coordinate Scaling System**: Preview-to-output coordinate transformation ensures generated overlays match editor preview exactly. Frontend captures base layout values (qrBaseSize, qrBaseX, qrBaseY) from preview canvas, scales them to actual overlay dimensions using scaleX/scaleY ratios, and sends to backend. Backend uses base values with percentage modifiers for precise positioning. Backward compatible with centering fallback for legacy overlays.
  - **Dashboard Overlay Gallery**: Toggle view between QR codes and overlays on dashboard page. Overlays displayed with 9:16 aspect ratio using object-contain for full banner visibility. Each overlay card shows status badge, creation date, CTA text, and download/delete buttons. Delete functionality with confirmation and optimistic cache invalidation.
  - API endpoints: GET /api/overlay-templates (requires auth), POST /api/overlays/generate (validated with insertOverlayRenditionSchema), GET /api/overlays (user's overlay history), GET /api/overlays/:id/download (serves rendered PNG), DELETE /api/overlays/:id (deletes overlay rendition).
  - Security: All endpoints require authentication, proper authorization (user owns QR code), input validation with max length enforcement.
- **Feedback System**: User feedback collection for continuous improvement.
  - **Database Schema**: Feedback table stores type (bug/feature/improvement/general), subject, message, email, and optional userId for authenticated users.
  - **Frontend**: Dedicated feedback form page (`/feedback`) with controlled Select component for feedback type, subject input, message textarea, and email field. Form validation via Zod, success/error handling with toast notifications. Footer buttons on homepage (guest and logged-in views) link to feedback page.
  - **Backend**: POST /api/feedback endpoint accepts feedback from both authenticated and guest users. Validates input with insertFeedbackSchema, stores submissions, returns success message.
  - **UX Features**: Success state with "Submit Another" and "Return Home" actions. All interactive elements have data-testid attributes for testing. Email field pre-populated for authenticated users, required for guests.

## External Dependencies

- **Database**: Neon PostgreSQL (with `@neondatabase/serverless` and Drizzle ORM)
- **Payment Processing**: Stripe (for subscription management, checkout, and webhooks)
- **Authentication**: Passport.js
- **QR Code Libraries**: `html5-qrcode`, `jsqr`, `qrcode`
- **Image Processing**: `sharp`
- **File Uploads**: `multer`
- **Utility Libraries**: `nanoid` (for slug generation), `UAParser` (for user agent parsing)
- **FFmpeg**: System dependency (for animated GIF QR code generation)
- **ImageMagick**: System dependency (for static PNG overlay rendering with rounded corners)