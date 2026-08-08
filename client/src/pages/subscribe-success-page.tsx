import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Copy, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";

interface CheckoutAccount {
  email?: string;
  tempPassword?: string;
  isNewAccount?: boolean;
}

export default function SubscribeSuccessPage() {
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [checkoutAccount, setCheckoutAccount] = useState<CheckoutAccount | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get("session_id");
    setSessionId(session);
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });

    if (session) {
      apiRequest("GET", `/api/checkout-account?session_id=${session}`)
        .then((r) => r.json())
        .then((data: CheckoutAccount) => setCheckoutAccount(data))
        .catch(() => setCheckoutAccount({}));
    }
  }, []);

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const userData = query.state.data as any;
      if (userData?.plan && userData.plan !== "free") return false;
      return 2000;
    },
  });

  const copyToClipboard = (text: string, field: "email" | "password") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full p-8 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
          <h1 className="text-2xl font-bold mb-2 font-heading">Processing...</h1>
          <p className="text-muted-foreground">Please wait while we confirm your subscription.</p>
        </Card>
      </div>
    );
  }

  const isPlanActivated = user && (user as any).plan !== "free";

  if (!isPlanActivated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
          <h1 className="text-2xl font-bold mb-2 font-heading">Activating Your Subscription</h1>
          <p className="text-muted-foreground">
            Your payment was successful! We're setting up your account now. This usually takes just a few seconds.
          </p>
        </Card>
      </div>
    );
  }

  const planName = (user as any).plan.charAt(0).toUpperCase() + (user as any).plan.slice(1);
  const isNewAccount = checkoutAccount?.isNewAccount;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
        </div>

        <h1 className="text-3xl font-bold mb-2 font-heading">
          {isNewAccount ? "Welcome to QR Social!" : `Welcome to QR Social ${planName}!`}
        </h1>

        {isNewAccount && checkoutAccount?.email ? (
          <>
            <p className="text-muted-foreground mb-6">
              Your <strong>{planName}</strong> subscription is active. We created an account for you — save these credentials to log in.
            </p>

            <div className="bg-muted rounded-lg p-4 text-left space-y-3 mb-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm break-all">{checkoutAccount.email}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 h-7 w-7"
                    onClick={() => copyToClipboard(checkoutAccount.email!, "email")}
                  >
                    {copied === "email" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              {checkoutAccount.tempPassword && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Temporary Password</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm">{checkoutAccount.tempPassword}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0 h-7 w-7"
                      onClick={() => copyToClipboard(checkoutAccount.tempPassword!, "password")}
                    >
                      {copied === "password" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground mb-6">
              You can change your password anytime in Settings after logging in.
            </p>

            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => setLocation("/auth")}
                data-testid="button-login"
              >
                Log In to Your Account
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/create")}
                data-testid="button-create-qr"
              >
                Create Your First QR Code
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-8">
              Your <strong>{planName}</strong> subscription is active. You now have full access to all premium features.
            </p>
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => setLocation("/create")}
                data-testid="button-create-qr"
              >
                Create Your First QR Code
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/dashboard")}
                data-testid="button-dashboard"
              >
                Go to Dashboard
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
