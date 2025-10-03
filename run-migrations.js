import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration (requires service role credentials)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigrations() {
  try {
    console.log("🚀 Starting database migrations...");

    // Read the SQL files
    const initialSetupSQL = fs.readFileSync(
      path.join(__dirname, "supabase/migrations/initial-setup.sql"),
      "utf8"
    );

    const wishesTableSQL = fs.readFileSync(
      path.join(
        __dirname,
        "supabase/migrations/20240322000006_create_wishes_table.sql"
      ),
      "utf8"
    );

    console.log("📄 Running initial setup migration...");
    const { error: initialError } = await supabase.rpc("exec_sql", {
      sql: initialSetupSQL,
    });

    if (initialError) {
      console.error("❌ Initial setup error:", initialError);
      return;
    }
    console.log("✅ Initial setup completed");

    console.log("📄 Running wishes table migration...");
    const { error: wishesError } = await supabase.rpc("exec_sql", {
      sql: wishesTableSQL,
    });

    if (wishesError) {
      console.error("❌ Wishes table error:", wishesError);
      return;
    }
    console.log("✅ Wishes table created");

    console.log("🎉 All migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  }
}

runMigrations();
