import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export default function SubscribeSuccessPage() {
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session_id');
    setSessionId(session);
    
    queryClient.invalidateQueries({ queryKey: ['/api/user'] });
  }, []);

  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/user'],
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const userData = query.state.data as any;
      if (userData?.plan && userData.plan !== 'free') {
        return false;
      }
      return 2000;
    },
  });

  if (isLoading || !sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full p-8 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
          <h1 className="text-2xl font-bold mb-2 font-heading">Processing...</h1>
          <p className="text-muted-foreground">
            Please wait while we confirm your subscription.
          </p>
        </Card>
      </div>
    );
  }

  const isPlanActivated = user && (user as any).plan !== 'free';

  if (!isPlanActivated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
          <h1 className="text-2xl font-bold mb-2 font-heading">Activating Your Subscription</h1>
          <p className="text-muted-foreground">
            Your payment was successful! We're activating your premium features now. This usually takes just a few seconds.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
        </div>
        
        <h1 className="text-3xl font-bold mb-4 font-heading">
          Welcome to QR Social {(user as any).plan.charAt(0).toUpperCase() + (user as any).plan.slice(1)}!
        </h1>
        
        <p className="text-muted-foreground mb-8">
          Your subscription has been activated successfully. You now have full access to all premium features including unlimited QR codes, advanced analytics, and more.
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
      </Card>
    </div>
  );
}
