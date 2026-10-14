import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getSubscribeSuccessCopy } from "./subscribe-success-copy";

export default function SubscribeSuccessPage() {
  const { user } = useAuth();
  const sessionId = new URLSearchParams(window.location.search).get("session_id");
  const { data, isLoading, error } = useQuery({
    queryKey: ["checkout-confirmation", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const response = await fetch(`/api/checkout-account?session_id=${encodeURIComponent(sessionId!)}`);
      if (!response.ok) throw new Error("Unable to confirm payment");
      return response.json() as Promise<{ paid: boolean }>;
    },
  });
  const copy = getSubscribeSuccessCopy({
    hasSessionId: !!sessionId,
    isLoading,
    paid: !!data?.paid,
    hasError: !!error,
    hasUser: !!user,
  });
  return <div className="min-h-[80vh] flex items-center justify-center p-4">
    <Card className="max-w-md w-full p-8 text-center space-y-4">
      <h1 className="text-2xl font-bold">{copy.title}</h1>
      {copy.description && <p className="text-muted-foreground">{copy.description}</p>}
      {copy.primaryLabel && copy.primaryHref && <Button asChild className="w-full"><Link href={copy.primaryHref}>{copy.primaryLabel}</Link></Button>}
      {copy.secondaryLabel && copy.secondaryHref && <Button variant="outline" asChild className="w-full"><Link href={copy.secondaryHref}>{copy.secondaryLabel}</Link></Button>}
    </Card>
  </div>;
}
