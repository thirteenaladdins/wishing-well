// Test script to verify the make_wish RPC call
// Run this in your browser console or as a separate script

const SUPABASE_URL = "https://hlthlqekfvepexbidrbl.supabase.co";
const SUPABASE_ANON_KEY = "your_anon_key_here"; // Replace with your actual anon key

async function testMakeWish() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/make_wish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Profile": "public",
      },
      body: JSON.stringify({
        session_token_param: "test_session_123",
        wish_content: "This is a test wish from JavaScript",
      }),
    });

    console.log("Response status:", response.status);
    console.log(
      "Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    const responseText = await response.text();
    console.log("Response body:", responseText);

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log("Success! Created wish:", data);
    } else {
      console.error("Error response:", responseText);
    }
  } catch (error) {
    console.error("Network error:", error);
  }
}

// Run the test
testMakeWish();
