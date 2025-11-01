import { QrCode, Home, Plus, LayoutDashboard } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export function TopHeader() {
  const { user } = useAuth();
  const [location] = useLocation();

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  const navItems = [
    { icon: Home, label: "Feed", path: "/" },
    { icon: Plus, label: "Create", path: "/create" },
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Button variant="ghost" className="hover-elevate px-3 py-2" asChild>
          <Link href="/" data-testid="link-home">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <QrCode className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold text-lg hidden sm:inline">
              QR Social
            </span>
          </Link>
        </Button>

        {user && (
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
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
        )}

        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          {user && (
            <Button variant="ghost" className="hover-elevate rounded-full h-auto p-0" asChild>
              <Link href={`/profile/${user.id}`} data-testid="link-profile">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                </Avatar>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
