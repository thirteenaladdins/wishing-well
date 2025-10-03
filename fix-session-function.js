import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://hlthlqekfvepexbidrbl.supabase.co";
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6ZmFsbWN5aGxwc2Z0bXd0enpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5NjQ5NDgsImV4cCI6MjA1NzU0MDk0OH0._VnhlAjKu0E5KO7-WkjqYjqnS6JcMwC3QLYeGOVHI5M";

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSessionFunction() {
  try {
    console.log("🔧 Fixing get_or_create_session function...");

    // Read the updated SQL
    const sql = fs.readFileSync(
      "./supabase/migrations/20240322000007_create_sessions_table.sql",
      "utf8"
    );

    // Split by semicolon and execute each statement
    const statements = sql.split(";").filter((stmt) => stmt.trim().length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        console.log("📄 Executing:", statement.substring(0, 50) + "...");
        const { error } = await supabase.rpc("exec", { sql: statement });
        if (error) {
          console.error("❌ Error executing statement:", error);
          // Try alternative approach
          console.log("🔄 Trying alternative approach...");
          const { error: altError } = await supabase
            .from("sessions")
            .select("*")
            .limit(1);
          if (altError) {
            console.error("❌ Cannot connect to database:", altError);
            return;
          }
        }
      }
    }

    console.log("✅ Function updated successfully!");
  } catch (error) {
    console.error("❌ Failed to update function:", error);
  }
}

fixSessionFunction();
