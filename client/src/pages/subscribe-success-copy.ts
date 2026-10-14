export type SubscribeSuccessContext = {
  hasSessionId: boolean;
  isLoading: boolean;
  paid: boolean;
  hasError: boolean;
  hasUser: boolean;
};

export function getSubscribeSuccessCopy(context: SubscribeSuccessContext) {
  const { hasSessionId, isLoading, paid, hasError, hasUser } = context;
  if (!hasSessionId || hasError || (!isLoading && !paid)) {
    return {
      title: "Payment not confirmed",
      description: "We could not confirm a completed payment. You can return to pricing or check your account.",
      primaryLabel: "Back to pricing",
      primaryHref: "/pricing",
      secondaryLabel: null,
      secondaryHref: null,
    };
  }
  if (isLoading) {
    return {
      title: "Confirming payment…",
      description: null,
      primaryLabel: null,
      primaryHref: null,
      secondaryLabel: null,
      secondaryHref: null,
    };
  }
  return {
    title: "Thank you for subscribing!",
    description: hasUser
      ? "Your payment is confirmed. Your plan will appear once payment processing finishes."
      : "Your payment is confirmed. Create your secure sign-in using the same email you entered at checkout. If you already have a Clerk sign-in, log in instead.",
    primaryLabel: hasUser ? "Go to dashboard" : "Set up your sign-in",
    primaryHref: hasUser ? "/dashboard" : "/sign-up",
    secondaryLabel: hasUser ? null : "Already registered? Sign in",
    secondaryHref: hasUser ? null : "/sign-in",
  };
}
