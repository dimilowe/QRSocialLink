import { useAuth } from "../_shared/stubs";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Link } from "../_shared/stubs";
import { QrCode, BarChart3, Target, Zap, Video, TrendingUp, MessageSquare } from "lucide-react";

export default function HomePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-[calc(100dvh-4rem)] bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-[4.5rem]">
          <div className="mx-auto mb-14 max-w-3xl text-center sm:mb-16">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.19em] text-primary">QR Social · Campaign analytics</p>
            <h1 className="mb-5 font-heading text-4xl font-semibold leading-[1.08] tracking-[-0.055em] sm:text-5xl md:text-[3.65rem]" data-testid="text-hero-title">
              QR Code Marketing Analytics
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Create branded QR codes, track performance with A/B testing, and drive traffic from social media
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-3">
              <Link href="/create">
                <Button size="lg" data-testid="button-get-started">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/auth">
                <Button variant="outline" size="lg" data-testid="button-login">
                  Log In
                </Button>
              </Link>
            </div>
          </div>

          <div className="mb-12 grid gap-4 md:mb-14 md:grid-cols-3 md:gap-5">
            <Card className="home-feature-card">
              <CardHeader className="pb-3">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"><QrCode className="h-5 w-5 text-primary" /></div>
                <CardTitle>Branded QR Codes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Create custom QR codes with your brand colors, logos, and overlay frames for maximum engagement
                </p>
              </CardContent>
            </Card>

            <Card className="home-feature-card">
              <CardHeader className="pb-3">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"><BarChart3 className="h-5 w-5 text-primary" /></div>
                <CardTitle>A/B Testing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Test multiple destinations and let AI automatically optimize traffic distribution for best results
                </p>
              </CardContent>
            </Card>

            <Card className="home-feature-card">
              <CardHeader className="pb-3">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"><Target className="h-5 w-5 text-primary" /></div>
                <CardTitle>Advanced Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track device types, platforms (TikTok, Instagram), OS, browser, and virality waves
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:gap-5">
            <Card className="home-feature-card">
              <CardHeader className="pb-3">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary"><Video className="h-5 w-5 text-primary" /></div>
                <CardTitle>Video Overlay Frames</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Add your QR codes to animated video overlays and track which designs drive the most scans
                </p>
              </CardContent>
            </Card>

            <Card className="home-feature-card">
              <CardHeader className="pb-3">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary"><TrendingUp className="h-5 w-5 text-primary" /></div>
                <CardTitle>Social Media Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  See which platforms generate the most traffic - TikTok, Instagram, YouTube, or Facebook
                </p>
              </CardContent>
            </Card>
          </div>

          <footer className="mt-14 border-t border-border/80 py-8 md:mt-16">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Have feedback or suggestions? We'd love to hear from you.
              </p>
              <Link href="/feedback">
                <Button variant="outline" data-testid="button-feedback">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Share Feedback
                </Button>
              </Link>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-background pb-24">
      <div className="mx-auto max-w-6xl px-4 py-9 sm:px-6">
        <div className="mb-8">
          <h1 className="mb-2 font-heading text-3xl font-semibold tracking-[-0.045em]">
            Welcome back, {user.username}!
          </h1>
          <p className="text-muted-foreground">
            Manage your QR codes, campaigns, and track analytics
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          <Link href="/create">
            <Card className="home-feature-card h-full" data-testid="card-create-qr">
              <CardHeader className="pb-3">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"><Zap className="h-5 w-5 text-primary" /></div>
                <CardTitle>Create QR Code</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Generate a new branded QR code for your marketing campaign
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/campaigns">
            <Card className="home-feature-card h-full" data-testid="card-campaigns">
              <CardHeader className="pb-3">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"><BarChart3 className="h-5 w-5 text-primary" /></div>
                <CardTitle>Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Create A/B tests and track performance across different destinations
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard">
            <Card className="home-feature-card h-full" data-testid="card-my-qr-codes">
              <CardHeader className="pb-3">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"><QrCode className="h-5 w-5 text-primary" /></div>
                <CardTitle>My QR Codes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  View, edit, and download all your created QR codes
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <footer className="mt-14 border-t border-border/80 py-8">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Have feedback or suggestions? We'd love to hear from you.
            </p>
            <Link href="/feedback">
              <Button variant="outline" data-testid="button-feedback">
                <MessageSquare className="h-4 w-4 mr-2" />
                Share Feedback
              </Button>
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
