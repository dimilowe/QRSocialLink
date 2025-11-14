import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Crown, Building2, Check, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 10,
    icon: Sparkles,
    description: "Perfect for personal projects",
    popular: false,
    features: [
      "20 editable QR codes",
      "Save & download QR codes",
      "Edit QR destinations anytime",
      "Basic analytics & tracking",
      "Custom colors & designs",
      "6 border shapes",
    ],
    cta: "Get Starter",
  },
  {
    id: "pro",
    name: "Pro",
    price: 30,
    icon: Crown,
    description: "Best for professionals & marketers",
    popular: true,
    features: [
      "50 editable QR codes",
      "Save & download QR codes",
      "Advanced analytics dashboard",
      "A/B testing & campaigns",
      "Custom branding & colors",
      "Platform overlay generator",
      "Priority support",
    ],
    cta: "Get Pro",
  },
  {
    id: "enterprise",
    name: "Unlimited",
    price: 99,
    icon: Building2,
    description: "For businesses & teams",
    popular: false,
    features: [
      "Unlimited QR codes",
      "Save & download QR codes",
      "Full analytics dashboard",
      "Advanced campaign management",
      "Custom branding removal",
      "Team collaboration",
      "Dedicated support",
      "API access",
    ],
    cta: "Get Unlimited",
  },
];

export default function PricingPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const createCheckoutSession = useMutation({
    mutationFn: async (planTier: string) => {
      const response = await apiRequest("POST", "/api/create-checkout-session", { planTier });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.message) {
        toast({
          title: "Already subscribed",
          description: data.message,
        });
        setTimeout(() => setLocation("/dashboard"), 2000);
      } else if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelectPlan = (planId: string) => {
    if (!user) {
      setLocation("/auth");
      return;
    }

    createCheckoutSession.mutate(planId);
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary" data-testid="badge-pricing">
            <Zap className="w-3 h-3 mr-1" />
            Pricing
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 font-heading">
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Build and preview QR codes for free. Subscribe to save, download, and unlock powerful analytics.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = user?.plan === plan.id;
            
            return (
              <Card
                key={plan.id}
                className={`relative p-6 ${
                  plan.popular ? "border-primary border-2 shadow-lg" : ""
                }`}
                data-testid={`card-plan-${plan.id}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground" data-testid="badge-popular">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <Icon className="w-8 h-8 text-primary" />
                  {isCurrentPlan && (
                    <Badge variant="outline" data-testid="badge-current">
                      Current Plan
                    </Badge>
                  )}
                </div>

                <h3 className="text-2xl font-bold mb-2 font-heading">{plan.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={createCheckoutSession.isPending || isCurrentPlan}
                  data-testid={`button-subscribe-${plan.id}`}
                >
                  {createCheckoutSession.isPending
                    ? "Processing..."
                    : isCurrentPlan
                    ? "Current Plan"
                    : plan.cta}
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="max-w-3xl mx-auto mt-16">
          <h2 className="text-2xl font-bold mb-6 text-center font-heading">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Can I use QR Social for free?</h3>
              <p className="text-muted-foreground text-sm">
                Yes! You can build and preview QR codes for free. However, to save, download, or access analytics, you'll need a paid subscription.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-muted-foreground text-sm">
                Absolutely. You can cancel your subscription at any time. Your access will continue until the end of your billing period.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground text-sm">
                We accept all major credit cards, Apple Pay, Google Pay, and more through Stripe, our secure payment processor.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
