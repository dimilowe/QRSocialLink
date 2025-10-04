# QR Social - Design Guidelines

## Design Approach
**Reference-Based Social Platform Design** drawing inspiration from Instagram (feed and profiles), Linear (clean UI and typography), and Venmo (social activity feed). The design emphasizes quick scanning interactions, social engagement, and a premium feel that justifies the Pro tier upgrade.

## Core Design Principles
1. **Scan-First Mobile Experience**: Optimize for one-handed mobile usage with thumb-friendly zones
2. **Instant Gratification**: Visual feedback for every scan and social interaction
3. **Trust & Security**: Clean, professional aesthetic to build confidence in QR scanning
4. **Premium Differentiation**: Free tier looks polished; Pro tier feels exclusive

## Color Palette

**Dark Mode (Primary)**
- Background: 222 10% 10% (deep charcoal)
- Surface: 222 10% 15% (elevated cards)
- Border: 222 10% 25% (subtle divisions)
- Primary Brand: 270 70% 60% (vibrant purple - scanning accent)
- Success: 142 70% 45% (scan success green)
- Text Primary: 0 0% 95%
- Text Secondary: 0 0% 70%

**Light Mode**
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Border: 220 10% 90%
- Primary Brand: 270 70% 55%
- Text Primary: 222 20% 15%
- Text Secondary: 222 10% 45%

**Accent Colors**
- Pro Badge: 45 100% 55% (gold for premium features)
- Alert/Notification: 10 80% 55% (coral red)

## Typography
**Fonts**: Inter (UI/body), Space Grotesk (headings/brand)
- Headings: Space Grotesk, font-bold, tracking-tight
- Body: Inter, font-normal, leading-relaxed
- UI Elements: Inter, font-medium
- Scale: text-xs (11px), text-sm (14px), text-base (16px), text-lg (18px), text-xl (20px), text-2xl (24px), text-4xl (36px)

## Layout System
**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24
- Compact spacing: p-2, gap-4 (mobile cards, tight lists)
- Standard spacing: p-4, p-6, gap-6 (feed items, forms)
- Generous spacing: p-8, p-12, py-16 (sections, headers)

**Container Strategy**
- Feed: max-w-2xl mx-auto (optimal reading width)
- Profile: max-w-4xl mx-auto (allows sidebar layouts)
- Modals: max-w-lg (focused interactions)

## Component Library

### Navigation
**Top App Bar** (sticky, backdrop-blur)
- Logo + brand (left), scan button (center FAB), profile avatar (right)
- Height: h-16 on mobile, h-20 on desktop
- Icons: 24px, purple accent on active state

**Bottom Navigation** (mobile only, fixed)
- 4 tabs: Feed, Scan, Activity, Profile
- Icons with labels, 56px height
- Active state: primary color with subtle scale transform

### Feed Components

**Scan Card** (core feed item)
- Container: rounded-xl, border, p-4, gap-3
- User header: avatar (40px circle) + username + timestamp + follow button
- QR Preview: aspect-square, rounded-lg, max-w-full, bg-white p-4 (QR needs white background)
- Link Preview: text-sm, truncate, text-secondary with external link icon
- Action Bar: like button + comment count + rescan button (icon-only, spaced evenly)
- Engagement counters: text-xs, text-secondary

**Infinite Scroll Feed**
- Gap between cards: gap-4 on mobile, gap-6 on desktop
- Loading skeleton: pulse animation on card-shaped divs
- Pull-to-refresh indicator at top

### Scanning Interface

**Camera View** (fullscreen overlay)
- Dark backdrop with camera feed in center
- Scanning frame: dashed border, corner brackets (animated pulse)
- Instructions: "Position QR code within frame" - text-center, text-white, absolute bottom
- Close button: top-left, icon-only, blur background
- Upload button: bottom-right corner, rounded-full, primary color

**Scan Success State**
- Checkmark animation (scale-in from center)
- Decoded URL displayed in card with "Open Link" CTA
- Save to history toggle (on by default for logged-in users)

### Profile Page

**Profile Header**
- Cover gradient: purple to blue, h-32
- Avatar: -mt-12 to overlap cover, 96px circle, border-4 border-background
- Username: text-2xl, font-bold
- Stats row: Scans | Followers | Following (clickable counts)
- Edit Profile / Follow button below stats

**Scan History Grid**
- Grid: grid-cols-3 gap-2 on mobile, grid-cols-4 gap-4 on desktop
- Each item: aspect-square, rounded-lg, QR thumbnail, hover overlay with link preview
- Free tier: Show 10 items + "Upgrade to Pro" card
- Pro tier: Infinite scroll with all history

### Subscription UI

**Upgrade Modal**
- Two-column comparison: Free vs Pro
- Feature list with checkmarks/x-marks
- Pricing: $15/mo prominently displayed
- CTA: "Upgrade to Pro" button, full-width, primary color, font-semibold
- Trust indicators: "Cancel anytime" + Stripe badge

**Pro Badge** (appears throughout app)
- Inline badge next to username: rounded-full, px-2, py-0.5, text-xs, gold gradient
- Icon: crown or star glyph

### Forms & Inputs

**Text Input**
- Height: h-12
- Padding: px-4
- Border: border-2, focus:border-primary
- Background: dark mode bg-surface, light mode bg-white
- Rounded: rounded-lg

**Buttons**
- Primary: bg-primary, text-white, h-12, px-6, rounded-lg, font-semibold
- Secondary: variant="outline", border-2
- Icon buttons: w-10 h-10, rounded-full, flex items-center justify-center
- Floating Action Button (Scan): w-16 h-16, rounded-full, shadow-lg, fixed bottom-20 right-6

### Social Interactions

**Like Button**
- Unfilled heart icon (outline)
- Filled heart on active (solid, primary color)
- Count displayed next to icon
- Tap animation: scale bounce

**Comment Section**
- Expandable below scan card
- Comments: avatar (32px) + username + text + timestamp
- Input: sticky bottom, h-12, rounded-full, with send button

**Follow Button**
- Small: h-8, px-4, text-sm (in feed cards)
- Large: h-10, px-6, text-base (in profile header)
- States: "Follow" (outline) → "Following" (filled)

## Animations
**Minimal & Purposeful**
- Scan success: checkmark scale-in (300ms ease-out)
- Like: heart pop (200ms spring)
- Card transitions: fade-in on scroll into view
- Loading states: subtle pulse, no spinners
- NO: parallax, complex scroll animations, auto-playing carousels

## Images

**Hero Section** (Landing/Marketing page - if created separately)
- Large hero image showing phone with QR scanning in action
- Overlay: gradient from bottom, text-white
- CTA buttons with blur background

**Feed QR Thumbnails**
- Always display QR codes on white background (essential for scanning)
- Rounded corners (rounded-lg)
- Aspect ratio: square (1:1)

**User Avatars**
- Default: gradient based on username hash + initials
- Sizes: 32px (comments), 40px (feed), 64px (activity), 96px (profile)
- All avatars: rounded-full with subtle border

**Empty States**
- Illustration or icon + descriptive text
- Example: "No scans yet" with QR code illustration and "Start Scanning" CTA

## Responsive Behavior
- Mobile (< 768px): Single column, bottom nav, compact spacing
- Tablet (768-1024px): Same layout, increased padding
- Desktop (> 1024px): Centered content, max-w-2xl for feed, sidebar for profile stats

## Dark Mode Implementation
- Default to dark mode (better for camera scanning)
- Toggle in profile settings
- Consistent across all components, including form inputs