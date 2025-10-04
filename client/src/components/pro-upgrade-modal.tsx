import { Check, Crown } from "lucide-react";
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

export function ProUpgradeModal({ open, onOpenChange }: ProUpgradeModalProps) {
  const [, setLocation] = useLocation();

  const handleUpgrade = () => {
    onOpenChange(false);
    setLocation("/subscribe");
  };

  const freeFeatures = [
    "Unlimited scans",
    "Last 10 scans in history",
    "1 QR drop per month",
    "Public feed access",
  ];

  const proFeatures = [
    "Everything in Free",
    "Unlimited scan history",
    "Dynamic QR codes",
    "Scan analytics & insights",
    "Branded QR skins",
    "Unlimited QR drops",
    "Priority support",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-pro-upgrade">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading flex items-center gap-2">
            <Crown className="h-6 w-6 text-[hsl(var(--pro-badge-from))]" />
            Upgrade to Pro
          </DialogTitle>
          <DialogDescription>
            Unlock premium features and take your QR scanning to the next level
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 my-4">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="font-heading font-bold text-lg mb-1">Free</h3>
              <p className="text-2xl font-bold">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            </div>
            
            <ul className="space-y-2">
              {freeFeatures.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6 space-y-4 border-primary relative overflow-hidden">
            <Badge
              className="absolute top-3 right-3 bg-gradient-to-r from-[hsl(var(--pro-badge-from))] to-[hsl(var(--pro-badge-to))] text-white border-0"
              data-testid="badge-pro-modal"
            >
              POPULAR
            </Badge>
            
            <div>
              <h3 className="font-heading font-bold text-lg mb-1">Pro</h3>
              <p className="text-2xl font-bold">
                $15
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
            </div>
            
            <ul className="space-y-2">
              {proFeatures.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full h-12 font-semibold"
            onClick={handleUpgrade}
            data-testid="button-upgrade-to-pro"
          >
            <Crown className="h-5 w-5 mr-2" />
            Upgrade to Pro - $15/mo
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Cancel anytime • Secure payment via Stripe
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
