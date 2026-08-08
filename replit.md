# QR Social

## Overview
QR Social is a full-stack web application providing a marketing analytics platform for QR codes. It enables users to create custom-branded QR codes, implement A/B testing, and track comprehensive analytics including device types, social media traffic sources, operating systems, browsers, and virality trends. The platform operates on a freemium model, allowing free preview and building of QR codes, with a 3-tier paid subscription system (Starter, Pro, Unlimited) required for saving or downloading. Its core purpose is to equip marketers with tools to optimize QR code campaigns, enhance user engagement, and drive conversions.

## User Preferences

### Database Configuration
**Always use Neon PostgreSQL** for future builds with this proven configuration:

```typescript
// db/index.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * => as schema from "@shared/schema";

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

### Database Migrations

**Development vs Production:**
- Development database uses the `DATABASE_URL` environment variable in the Replit workspace
- Production database uses a separate `DATABASE_URL` configured in the deployment settings
- Schema changes must be applied to both databases separately

**Automatic Migration System:**
- The app includes an automatic migration system (`server/migrate.ts`) that runs `drizzle-kit push` on production startup
- This attempts to sync schema changes automatically but has limitations:
  - May not detect all schema drift (e.g., missing columns)
  - Fails silently to prevent production downtime
  - Logs warnings when migrations fail

**Manual Migration Process (Recommended for Critical Changes):**

When you make schema changes in `shared/schema.ts`:

1. **Development**: Run `npm run db:push` to apply changes to development database

2. **Production**: Apply changes manually using SQL:
   ```bash
   # Get production DATABASE_URL from Deployments > Environment Variables
   DATABASE_URL="<production_url>" psql -c "ALTER TABLE table_name ADD COLUMN column_name type;"
   ```

3. **Verify**: Check the column was added:
   ```bash
   DATABASE_URL="<production_url>" psql -c "\d table_name"
   ```

4. **Deploy**: Redeploy the app to restart with the updated schema

**Common Migration Commands:**
- Add column: `ALTER TABLE scans ADD COLUMN destination text;`
- Check schema: `\d table_name`
- List all tables: `\dt`

**Production Database Access:**
- Find production `DATABASE_URL` in: Deployments tab > qrsocial.io > Environment Variables
- Use `psql` with the production URL to run SQL commands
- Always test commands on development first

**Important Notes:**
- Automatic migrations may fail to detect all schema changes
- For critical schema updates, always use manual SQL migrations
- Never change primary key types - this breaks existing data
- Use `npm run db:push --force` if standard push doesn't work in development

## System Architecture

**UI/UX Decisions:**
- **Design System**: Dark mode by default with light mode toggle, purple primary color (270 70% 60%), Inter font for body, Space Grotesk for headings.
- **Layout**: Responsive (mobile-first) with top header and bottom navigation for mobile.
- **Branding**: Custom QR codes include purple borders, "qrsocial.com" branding, "long-press to open" instructions, and "Made with QR Social" watermark.
- **Workflow**: Marketing-focused home page, dedicated QR creation page with real-time preview, and intuitive navigation for campaigns and QR codes.

**Technical Implementations:**
- **Frontend**: React, TypeScript, Tailwind CSS, Wouter, TanStack Query, Shadcn UI.
- **Backend**: Express.js, Node.js, Passport.js (authentication).
- **Database ORM**: Drizzle ORM.
- **QR Code Handling**: `html5-qrcode` (camera scanning), `jsqr` (image upload), `qrcode` (generation), `gifler` (animated GIF backgrounds).
- **Split Testing**: Weighted random strategy for manual traffic distribution.
- **Analytics**: Scan event logging with IP hashing, user agent parsing (UAParser).
- **Subscription Management**: Stripe Checkout integration with webhooks for multi-tier subscriptions.
- **Image Processing**: `sharp` (manipulation), `multer` (uploads).
- **Dynamic Redirects**: Short slugs for dynamic QR code URLs (`/r/:slug`).

**Feature Specifications:**
- **Authentication**: Email/password via Passport.js, session-based.
- **QR Code Management**: Custom branded QR code creation with color, background images (static/animated GIFs), image fit modes, real-time preview, download (PNG/GIF), storage, and history. Editable destinations for paid plans. Scan tracking via `/q/:slug` with automatic regeneration.
- **Subscription Model**: Preview-only free access + 3 paid tiers (Starter, Pro, Unlimited). Feature-based limits enforced by backend, integrated with Stripe.
- **Campaigns & Split Testing**: QR codes support "Simple Mode" (direct URL tracking) and "Split Testing Mode" (campaign-based multi-variant testing with weighted distribution). Backend redirect logic prioritizes campaign destinations, then `destination`, then `redirectUrl`, then `decodedUrl`. Manual adjustment of traffic weights based on impressions. CRUD for campaigns and variants.
- **Advanced Analytics**: Comprehensive tracking for campaigns and individual QR codes, including device, social media sources, OS/browser breakdown, and time-series data via `/api/scans/:scanId/analytics`.
- **Download Functionality**: Download QR codes as static PNGs or animated GIFs.
- **Animated GIF Support**: Upload animated GIFs as QR code backgrounds with real-time preview. Backend FFmpeg processing overlays transparent QR on each frame for download.
- **Platform-Specific Overlay Generator**: Create social media-optimized overlay frames (TikTok, YouTube Shorts, Instagram Reels) with customizable CTA text.
  - **Interactive Canva-Style Editor**: Click-and-drag QR code repositioning, resize handles, visual selection, bidirectional sync with sliders. Performance-optimized with data caching and coordinate translation. Percentage-based QR offset system.
  - Authenticated overlay endpoints with Zod validation. Database schema for `overlayRenditions` and `frames`.
  - **Background Processing & Rendering**: Asynchronous generation via `OverlayProcessor` service, ImageMagick-based rendering pipeline for static PNGs, composites black background, rounded rectangle, QR code, CTA text. Status workflow: queued → rendering → completed/failed.
  - **Coordinate Scaling System**: Preview-to-output coordinate transformation for exact matching.
  - **Dashboard Overlay Gallery**: Toggle view, 9:16 aspect ratio display, status badge, creation date, CTA text, download/delete buttons.
  - API endpoints: `GET /api/overlay-templates`, `POST /api/overlays/generate`, `GET /api/overlays`, `GET /api/overlays/:id/download`, `DELETE /api/overlays/:id`.
  - Security: Authentication, authorization, input validation.
- **Feedback System**: User feedback collection (bug/feature/improvement/general) via dedicated form (`/feedback`).
  - **Database Schema**: `Feedback` table stores type, subject, message, email, optional `userId`.
  - **Backend**: `POST /api/feedback` endpoint validates and stores submissions.
  - **UX Features**: Success state, "Submit Another", "Return Home" actions, `data-testid` attributes, email pre-population for authenticated users.

## External Dependencies

- **Database**: Neon PostgreSQL (`@neondatabase/serverless`, Drizzle ORM)
- **Payment Processing**: Stripe
- **Authentication**: Passport.js
- **QR Code Libraries**: `html5-qrcode`, `jsqr`, `qrcode`
- **Image Processing**: `sharp`
- **File Uploads**: `multer`
- **Utility Libraries**: `nanoid`, `UAParser`
- **System Dependencies**: FFmpeg, ImageMagick