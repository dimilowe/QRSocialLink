import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { QrCode } from "lucide-react";
import { useLocation } from "wouter";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("login");

  const handleSuccess = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/20 via-background to-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <QrCode className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-heading font-bold mb-2" data-testid="text-app-title">
            QR Social
          </h1>
          <p className="text-muted-foreground">
            Scan, share, and discover QR codes
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading">
              {activeTab === "login" ? "Welcome back" : "Create account"}
            </CardTitle>
            <CardDescription>
              {activeTab === "login"
                ? "Log in to continue scanning and sharing"
                : "Join the QR Social community"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" data-testid="tab-login">Log In</TabsTrigger>
                <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm onSuccess={handleSuccess} />
              </TabsContent>
              <TabsContent value="signup">
                <SignupForm onSuccess={handleSuccess} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
