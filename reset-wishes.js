import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hlthlqekfvepexbidrbl.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6ZmFsbWN5aGxwc2Z0bXd0enpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5NjQ5NDgsImV4cCI6MjA1NzU0MDk0OH0._VnhlAjKu0E5KO7-WkjqYjqnS6JcMwC3QLYeGOVHI5M";

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetWishes() {
  // Get your session token from localStorage
  const sessionToken = localStorage.getItem("wishing_well_session");
  console.log("Session token:", sessionToken);

  if (!sessionToken) {
    console.error("No session token found");
    return;
  }

  try {
    // Reset purchased wishes to 0
    const { error } = await supabase
      .from("sessions")
      .update({ purchased_wishes: 0, free_wish_used: false })
      .eq("session_token", sessionToken);

    if (error) {
      console.error("Error resetting wishes:", error);
    } else {
      console.log("Successfully reset wishes to 0");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the reset
resetWishes();
