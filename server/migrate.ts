import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function runMigrations(): Promise<void> {
  // Temporarily disabled - drizzle-kit push is unreliable for production migrations
  // Use manual SQL migrations instead (see replit.md for instructions)
  console.log("[Migration] Auto-migrations disabled - using manual migration process");
  return;
}
