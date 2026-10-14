import { QrCode, Home, Plus, LayoutDashboard, BarChart3, Sparkles, CreditCard, Settings } from "lucide-react";
import { Sun } from "lucide-react";
function ThemeToggle(){return <Button variant="ghost" size="icon" aria-label="Toggle theme"><Sun className="h-5 w-5"/></Button>;}
import { useAuth } from "../_shared/stubs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, useLocation } from "../_shared/stubs";
import { Button } from "./button";

export function RefinedHeader() {
  const { user } = useAuth();
  const [location] = useLocation();

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Plus, label: "Create QR", path: "/create" },
    { icon: Sparkles, label: "Overlays", path: "/overlays" },
    { icon: BarChart3, label: "Campaigns", path: "/campaigns" },
    { icon: LayoutDashboard, label: "My QR Codes", path: "/dashboard" },
    { icon: CreditCard, label: "Pricing", path: "/pricing" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Button variant="ghost" className="px-2.5 py-2 hover:bg-secondary/70" asChild>
          <Link href="/" data-testid="link-home">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
              <QrCode className="h-[18px] w-[18px] text-primary-foreground" />
            </div>
            <span className="hidden font-heading text-[17px] font-bold tracking-[-0.04em] sm:inline">
              QR Social
            </span>
          </Link>
        </Button>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems
            .filter((item) => user || item.path === "/create" || item.path === "/pricing")
            .map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={`gap-2 px-3 ${isActive ? "font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  asChild
                >
                  <Link href={item.path} data-testid={`nav-desktop-${item.label.toLowerCase()}`}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </Button>
              );
            })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {!user && (
            <Button variant="outline" size="sm" asChild data-testid="button-pricing">
              <Link href="/pricing">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Pricing</span>
              </Link>
            </Button>
          )}
          <ThemeToggle />
          
          {user && (
            <Button variant="ghost" size="icon" className="hover-elevate" asChild data-testid="link-settings">
              <Link href="/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          )}
          
          {user ? (
            <Button variant="ghost" className="hover-elevate rounded-full h-auto p-0" asChild>
              <Link href={`/profile/${user.id}`} data-testid="link-profile">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                </Avatar>
              </Link>
            </Button>
          ) : (
            <Button variant="default" size="sm" asChild data-testid="button-header-login">
              <Link href="/auth">
                Log In
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
