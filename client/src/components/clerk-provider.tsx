import { ClerkProvider } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { useLocation } from "wouter";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

export function AppClerkProvider({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    signInFallbackRedirectUrl={`${basePath}/dashboard`}
    signUpFallbackRedirectUrl={`${basePath}/dashboard`}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    localization={{
      signIn: { start: { title: "Welcome back to QR Social", subtitle: "Sign in to manage your QR codes" } },
      signUp: { start: { title: "Join QR Social", subtitle: "Use your checkout email to access your subscription" } },
    }}
    appearance={{
      theme: shadcn,
      options: {
        logoPlacement: "inside",
        logoLinkUrl: basePath || "/",
        logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
      },
      variables: {
        colorPrimary: "#8b3de0", colorForeground: "#20232c",
        colorMutedForeground: "#616975", colorBackground: "#ffffff",
        colorInput: "#ffffff", colorInputForeground: "#20232c",
        colorDanger: "#be123c", colorNeutral: "#20232c",
        fontFamily: "Inter, sans-serif", borderRadius: "0.75rem",
      },
      elements: {
        rootBox: { width: "100%", display: "flex", justifyContent: "center" },
        cardBox: { background: "#fff", width: "440px", maxWidth: "100%", borderRadius: "16px" },
        headerTitle: { color: "#20232c" }, headerSubtitle: { color: "#616975" },
        socialButtonsBlockButtonText: { color: "#20232c" },
        formFieldLabel: { color: "#20232c" }, footerActionLink: { color: "#7130b8" },
        footerActionText: { color: "#616975" }, dividerText: { color: "#616975" },
      },
    }}
  >{children}</ClerkProvider>;
}
