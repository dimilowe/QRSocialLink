import { Check, Crown, Sparkles, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

interface ProUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
      "Basic analytics",
      "Custom colors & designs",
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
      "Custom branding removal",
      "Team collaboration",
      "Dedicated support",
    ],
    cta: "Get Unlimited",
  },
];

export function ProUpgradeModal({ open, onOpenChange }: ProUpgradeModalProps) {
  const [, setLocation] = useLocation();

  const handleUpgrade = (planId: string) => {
    onOpenChange(false);
    setLocation("/pricing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="dialog-pro-upgrade">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading">
            Choose Your Plan
          </DialogTitle>
          <DialogDescription>
            Build and preview for free. Subscribe to save, download, and unlock powerful analytics.
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-3 gap-4 my-4">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.id}
                className={`p-5 space-y-4 relative ${
                  plan.popular ? "border-primary" : ""
                }`}
                data-testid={`card-plan-${plan.id}`}
              >
                {plan.popular && (
                  <Badge
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[hsl(var(--pro-badge-from))] to-[hsl(var(--pro-badge-to))] text-white border-0"
                    data-testid="badge-popular"
                  >
                    POPULAR
                  </Badge>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <h3 className="font-heading font-bold text-lg">{plan.name}</h3>
                  </div>
                  <p className="text-2xl font-bold">
                    ${plan.price}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleUpgrade(plan.id)}
                  data-testid={`button-upgrade-to-${plan.id}`}
                >
                  {plan.cta}
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          All plans include • Cancel anytime • Secure payment via Stripe
        </p>
      </DialogContent>
    </Dialog>
  );
}
