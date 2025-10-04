import { QrCode } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";

export function TopHeader() {
  const { user } = useAuth();

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" data-testid="link-home">
          <button className="flex items-center gap-2 hover-elevate px-3 py-2 rounded-lg">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <QrCode className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold text-lg hidden sm:inline">
              QR Social
            </span>
          </button>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          {user && (
            <Link href={`/profile/${user.id}`} data-testid="link-profile">
              <button className="hover-elevate rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                </Avatar>
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
