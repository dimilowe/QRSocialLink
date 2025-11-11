import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { QrCode, BarChart3, Target, Zap, Video, TrendingUp, MessageSquare } from "lucide-react";

export default function HomePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-heading font-bold mb-4" data-testid="text-hero-title">
              QR Code Marketing Analytics
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Create branded QR codes, track performance with A/B testing, and drive traffic from social media
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/auth">
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

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <Card className="hover-elevate">
              <CardHeader>
                <QrCode className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Branded QR Codes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Create custom QR codes with your brand colors, logos, and overlay frames for maximum engagement
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>A/B Testing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Test multiple destinations and let AI automatically optimize traffic distribution for best results
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <Target className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Advanced Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track device types, platforms (TikTok, Instagram), OS, browser, and virality waves
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="hover-elevate">
              <CardHeader>
                <Video className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Video Overlay Frames</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Add your QR codes to animated video overlays and track which designs drive the most scans
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <TrendingUp className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Social Media Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  See which platforms generate the most traffic - TikTok, Instagram, YouTube, or Facebook
                </p>
              </CardContent>
            </Card>
          </div>

          <footer className="mt-16 py-8 border-t">
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
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold mb-2">
            Welcome back, {user.username}!
          </h1>
          <p className="text-muted-foreground">
            Manage your QR codes, campaigns, and track analytics
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/create">
            <Card className="hover-elevate cursor-pointer h-full" data-testid="card-create-qr">
              <CardHeader>
                <Zap className="h-10 w-10 text-primary mb-2" />
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
            <Card className="hover-elevate cursor-pointer h-full" data-testid="card-campaigns">
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-2" />
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
            <Card className="hover-elevate cursor-pointer h-full" data-testid="card-my-qr-codes">
              <CardHeader>
                <QrCode className="h-10 w-10 text-primary mb-2" />
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

        <footer className="mt-16 py-8 border-t">
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
