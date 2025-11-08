import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import FeedPage from "@/pages/feed-page";
import ProfilePage from "@/pages/profile-page";
import SubscribePage from "@/pages/subscribe-page";
import CreateQRPage from "@/pages/create-qr-page";
import DashboardPage from "@/pages/dashboard-page";
import CampaignsPage from "@/pages/campaigns-page";
import CampaignDetailPage from "@/pages/campaign-detail-page";
import { TopHeader } from "@/components/top-header";
import { BottomNav } from "@/components/bottom-nav";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }): JSX.Element {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  return (
    <>
      <TopHeader />
      <Switch>
        <Route path="/auth">
          {() => {
            if (isLoading) {
              return (
                <div className="h-screen flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              );
            }
            return user ? <Redirect to="/" /> : <AuthPage />;
          }}
        </Route>
        <Route path="/" component={FeedPage} />
        <Route path="/create" component={() => <ProtectedRoute component={CreateQRPage} />} />
        <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
        <Route path="/campaigns" component={() => <ProtectedRoute component={CampaignsPage} />} />
        <Route path="/campaigns/:id" component={() => <ProtectedRoute component={CampaignDetailPage} />} />
        <Route path="/profile/:id" component={() => <ProtectedRoute component={ProfilePage} />} />
        <Route path="/subscribe" component={() => <ProtectedRoute component={SubscribePage} />} />
        <Route component={NotFound} />
      </Switch>
      {user && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
