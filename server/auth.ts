import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { type User as SelectUser } from "@shared/schema";
import { pool } from "../db";

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export function setupAuth(app: Express) {
  const PgStore = connectPgSimple(session);
  const isProduction = process.env.NODE_ENV === "production";
  const isReplitDev = process.env.REPL_SLUG !== undefined;
  const isSecure = isProduction || isReplitDev || process.env.REPLIT_DEPLOYMENT === "1";
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "qr-social-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
    },
    store: new PgStore({
      pool: pool,
      createTableIfMissing: true,
    }),
  };
  
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Auth] Session config - secure: ${isSecure}, sameSite: lax, isReplitDev: ${isReplitDev}`);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }
        const isValid = await crypto.compare(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Incorrect password." });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, username, password } = req.body;

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).send({ message: "Email already exists" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).send({ message: "Username already exists" });
      }

      const hashedPassword = await crypto.hash(password);
      const user = await storage.createUser({
        email,
        username,
        password: hashedPassword,
      });

      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        const { password: _, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User, info: any) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.status(400).send({
          message: info.message ?? "Login failed",
        });
      }

      req.login(user, (err) => {
        if (err) {
          return next(err);
        }

        const { password: _, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).send({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      const { password: _, ...userWithoutPassword } = req.user!;
      return res.json(userWithoutPassword);
    }
    res.status(401).send({ message: "Not authenticated" });
  });
}

export { crypto };
