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
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-card-border z-50 md:hidden">
      <div className="flex items-center justify-around h-16 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
            >
              <button
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
