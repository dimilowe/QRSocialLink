import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

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
  return <div className="min-h-[80vh] flex items-center justify-center p-4">
    <Card className="max-w-md w-full p-8 text-center space-y-4">
      <h1 className="text-2xl font-bold">
        {isLoading ? "Confirming payment…" : data?.paid ? "Thank you for subscribing!" : "Payment not confirmed"}
      </h1>
      {!sessionId || error || (!isLoading && !data?.paid)
        ? <><p>We could not confirm a completed payment. You can return to pricing or check your account.</p><Button asChild><Link href="/pricing">Back to pricing</Link></Button></>
        : data?.paid && <>
          <p className="text-muted-foreground">{user
            ? "Your payment is confirmed. Your plan will appear once payment processing finishes."
            : "Your payment is confirmed. Create your secure sign-in using the same email you entered at checkout. If you already have a Clerk sign-in, log in instead."}</p>
          <Button asChild className="w-full"><Link href={user ? "/dashboard" : "/sign-up"}>{user ? "Go to dashboard" : "Set up your sign-in"}</Link></Button>
          {!user && <Button variant="outline" asChild className="w-full"><Link href="/sign-in">Already registered? Sign in</Link></Button>}
        </>}
    </Card>
  </div>;
}
