import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function runMigrations(): Promise<void> {
  const isProd = process.env.NODE_ENV === "production";
  
  if (!isProd) {
    console.log("[Migration] Skipping migrations in development mode");
    return;
  }

  console.log("[Migration] Running database migrations...");
  
  try {
    const { stdout, stderr } = await execAsync("npx drizzle-kit push");
    
    if (stdout) {
      console.log("[Migration] Output:", stdout);
    }
    
    if (stderr && !stderr.includes("No changes detected")) {
      console.warn("[Migration] Warning:", stderr);
    }
    
    console.log("[Migration] ✓ Migrations completed successfully");
  } catch (error: any) {
    console.error("[Migration] ⚠ Migration failed - server will continue anyway:", error.message);
    
    if (error.stdout) {
      console.error("[Migration] stdout:", error.stdout);
    }
    
    if (error.stderr) {
      console.error("[Migration] stderr:", error.stderr);
    }
    
    console.error("[Migration] ⚠ WARNING: Schema may be out of sync. Manual migration may be required.");
  }
}
