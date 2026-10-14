import type { Express } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import type { User as LocalUser } from "@shared/schema";

type AuthStorage = Pick<typeof storage, "getUser" | "getUserByEmail" | "createUser">;
type AuthDependencies = {
  clerkClient: typeof clerkClient;
  getAuth: typeof getAuth;
  storage: AuthStorage;
};

declare global {
  namespace Express {
    interface User extends LocalUser {}
    interface Request {
      user?: User;
      isAuthenticated(): this is Request & { user: User };
    }
  }
}

// Clerk owns credentials and sessions. Keep local UUIDs for QR ownership/billing.
export function setupAuth(
  app: Express,
  dependencies: AuthDependencies = { clerkClient, getAuth, storage },
) {
  app.use(async (req, res, next) => {
    req.isAuthenticated = (() => !!req.user) as typeof req.isAuthenticated;
    if (!req.path.startsWith("/api/") || req.path === "/api/__clerk") return next();
    try {
      const { userId } = dependencies.getAuth(req);
      if (!userId) return next();
      const identity = await dependencies.clerkClient.users.getUser(userId);
      let user = identity.externalId
        ? await dependencies.storage.getUser(identity.externalId)
        : undefined;
      if (!user) {
        const emailAddress = identity.emailAddresses.find(
          (email) => email.id === identity.primaryEmailAddressId &&
            email.verification?.status === "verified",
        );
        if (!emailAddress) {
          return res.status(403).json({ message: "Verify your email to access your account." });
        }
        const email = emailAddress.emailAddress.toLowerCase().trim();
        user = await dependencies.storage.getUserByEmail(email);
        if (!user) {
          try {
            user = await dependencies.storage.createUser({
              email,
              username: email,
              // Unusable local credential; local password login no longer exists.
              password: randomBytes(48).toString("hex"),
            });
          } catch (error) {
            user = await dependencies.storage.getUserByEmail(email);
            if (!user) throw error;
          }
        }
        await dependencies.clerkClient.users.updateUser(userId, { externalId: user.id });
      }
      req.user = user;
      next();
    } catch (error) {
      console.error("[Auth] Unable to resolve Clerk account");
      res.status(503).json({ message: "Unable to load your account. Please try again." });
    }
  });

  app.get("/api/user", (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const { password, ...user } = req.user;
    res.json(user);
  });
}
