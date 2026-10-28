import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { OverlayProcessor } from "./overlay-processor";
import { storage } from "./storage";
import { runMigrations } from "./migrate";
import { mirrorYesterdayAnalyticsToVcmOs } from "./services/analyticsAggregation";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";

const app = express();

app.set('trust proxy', 1);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

app.use(clerkMiddleware((req) => ({
  publishableKey: publishableKeyFromHost(
    getClerkProxyHost(req) ?? "",
    process.env.CLERK_PUBLISHABLE_KEY,
  ),
})));
setupAuth(app);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await runMigrations();

  const overlayProcessor = new OverlayProcessor(storage);
  app.locals.overlayProcessor = overlayProcessor;

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve both the API and client. Avoid macOS AirPlay's port 5000 locally.
  const port = Number(process.env.PORT || (app.get("env") === "development" ? "3000" : "5000"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  server.on("error", (error: NodeJS.ErrnoException) => {
    console.error(error.code === "EADDRINUSE"
      ? `Port ${port} is already in use. Set PORT in .env to an available port.`
      : `Unable to start server: ${error.message}`);
    process.exit(1);
  });
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
    
    overlayProcessor.start();
    
    // VCM OS Analytics Mirroring - fire-and-forget, non-blocking
    // Run once at startup (for testing/catchup)
    mirrorYesterdayAnalyticsToVcmOs().catch(err => {
      console.error("[VCM OS Mirror] Startup mirror failed:", err);
    });
    
    // Run every 24 hours
    const ONE_DAY = 24 * 60 * 60 * 1000;
    setInterval(() => {
      mirrorYesterdayAnalyticsToVcmOs().catch(err => {
        console.error("[VCM OS Mirror] Scheduled mirror failed:", err);
      });
    }, ONE_DAY);
  });
})();
