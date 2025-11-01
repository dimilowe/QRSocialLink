import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, ArrowLeft, Sparkles, Building2 } from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

const PLAN_CONFIG = {
  starter: {
    name: "Starter",
    price: 10,
    icon: Sparkles,
    color: "from-blue-500 to-cyan-500",
  },
  pro: {
    name: "Pro",
    price: 30,
    icon: Crown,
    color: "from-[hsl(var(--pro-badge-from))] to-[hsl(var(--pro-badge-to))]",
  },
  enterprise: {
    name: "Enterprise",
    price: 99,
    icon: Building2,
    color: "from-purple-600 to-pink-600",
  },
} as const;

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const SubscribeForm = ({ planTier }: { planTier: keyof typeof PLAN_CONFIG }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const planConfig = PLAN_CONFIG[planTier];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      toast({
        title: "Payment Successful",
        description: `You are now a ${planConfig.name} member!`,
      });
      setTimeout(() => {
        setLocation("/profile");
      }, 1500);
    } else {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        className="w-full h-12"
        disabled={!stripe || isLoading}
        data-testid="button-submit-payment"
      >
        {isLoading ? "Processing..." : `Subscribe to ${planConfig.name} - $${planConfig.price}/mo`}
      </Button>
    </form>
  );
};

export default function SubscribePage() {
  const [location, setLocation] = useLocation();
  const [clientSecret, setClientSecret] = useState("");
  const [isProcessing, setIsProcessing] = useState(true);
  const { toast } = useToast();
  
  const urlParams = new URLSearchParams(window.location.search);
  const planTier = (urlParams.get("plan") || "pro") as keyof typeof PLAN_CONFIG;
  
  if (!PLAN_CONFIG[planTier]) {
    setLocation("/?error=invalid-plan");
    return null;
  }

  const planConfig = PLAN_CONFIG[planTier];

  useEffect(() => {
    apiRequest("POST", "/api/get-or-create-subscription", { planTier })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          toast({
            title: "Success!",
            description: data.message || "Your subscription has been updated.",
          });
          setTimeout(() => {
            setLocation("/profile");
          }, 1500);
        } else if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          setIsProcessing(false);
        } else {
          toast({
            title: "Error",
            description: "Unable to process subscription. Please try again.",
            variant: "destructive",
          });
          setTimeout(() => {
            setLocation("/");
          }, 2000);
        }
      })
      .catch((error) => {
        console.error("Failed to create subscription:", error);
        toast({
          title: "Error",
          description: "Failed to process subscription. Please try again.",
          variant: "destructive",
        });
        setIsProcessing(false);
      });
  }, [planTier, setLocation, toast]);

  if (!clientSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-md mx-auto">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-10 h-10 bg-gradient-to-br ${planConfig.color} rounded-lg flex items-center justify-center`}>
                <planConfig.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="font-heading">Upgrade to {planConfig.name}</CardTitle>
                <CardDescription>${planConfig.price} per month</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <SubscribeForm planTier={planTier} />
            </Elements>
            
            <p className="text-xs text-center text-muted-foreground mt-4">
              By subscribing, you agree to our terms. Cancel anytime from your profile settings.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
