import { createContext, useContext, useEffect } from "react";
import { User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { useClerk, useUser } from "@clerk/react";
import { queryClient } from "@/lib/queryClient";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
};
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: identity, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { data, isLoading, error, refetch } = useQuery<User>({
    queryKey: ["/api/user", identity?.id],
    enabled: isLoaded && !!identity,
    queryFn: async () => {
      const response = await fetch("/api/user", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load your account.");
      return response.json();
    },
    retry: 1,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "/api/user" });
  }, [identity?.id]);
  if (identity && error) {
    return <div className="p-8 text-center"><p>Unable to load your account.</p><button onClick={() => refetch()}>Try again</button></div>;
  }
  return <AuthContext.Provider value={{
    user: identity ? data ?? null : null,
    isLoading: !isLoaded || (!!identity && isLoading),
    login: () => { void refetch(); },
    logout: () => { queryClient.clear(); void signOut({ redirectUrl: "/" }); },
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
