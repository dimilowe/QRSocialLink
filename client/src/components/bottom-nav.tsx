import { Home, Plus, LayoutDashboard, CreditCard, LogIn } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();

  const authedNavItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Plus, label: "Create", path: "/create" },
    { icon: LayoutDashboard, label: "QR Codes", path: "/dashboard" },
    { icon: CreditCard, label: "Pricing", path: "/pricing" },
  ];

  const guestNavItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Plus, label: "Create", path: "/create" },
    { icon: CreditCard, label: "Pricing", path: "/pricing" },
    { icon: LogIn, label: "Sign Up", path: "/auth" },
  ];

  const navItems = user ? authedNavItems : guestNavItems;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(31,35,58,0.045)] backdrop-blur-xl md:hidden">
      <div className="flex h-[68px] items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              className={cn(
                  "flex min-w-[64px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs transition-colors",
                  isActive
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
            >
                <Icon className="h-5 w-5" />
                <span className="font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
