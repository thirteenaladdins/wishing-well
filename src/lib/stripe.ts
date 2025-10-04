import { supabase } from "../../supabase/supabase";

export interface BoostCheckoutOptions {
  wishId: string;
  who?: string;
  returnUrl?: string;
}

export interface BoostResult {
  success: boolean;
  error?: string;
  checkoutUrl?: string;
}

export async function createBoostCheckout({
  wishId,
  who,
  returnUrl = window.location.origin
}: BoostCheckoutOptions): Promise<BoostResult> {
  try {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        price_id: import.meta.env.VITE_STRIPE_BOOST_PRICE_ID || "price_boost_10p",
        session_token: who || "anonymous",
        return_url: returnUrl,
        metadata: {
          wish_id: wishId,
          type: "boost"
        }
      },
    });

    if (error) {
      console.error("Error creating boost checkout:", error);
      return {
        success: false,
        error: error.message || "Failed to create checkout session"
      };
    }

    if (!data?.url) {
      return {
        success: false,
        error: "No checkout URL returned"
      };
    }

    return {
      success: true,
      checkoutUrl: data.url
    };
  } catch (error) {
    console.error("Unexpected error creating boost checkout:", error);
    return {
      success: false,
      error: "An unexpected error occurred"
    };
  }
}

export async function boostWish(wishId: string, who?: string, sessionId?: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("boost", {
      body: {
        wishId,
        who,
        sessionId
      },
    });

    if (error) {
      console.error("Error boosting wish:", error);
      throw new Error(error.message || "Failed to boost wish");
    }

    return data?.ok === true;
  } catch (error) {
    console.error("Unexpected error boosting wish:", error);
    throw error;
  }
}

// Helper function to open Stripe checkout in a new window/tab
export function openBoostCheckout(options: BoostCheckoutOptions): Promise<boolean> {
  return new Promise(async (resolve) => {
    try {
      const result = await createBoostCheckout(options);
      
      if (!result.success || !result.checkoutUrl) {
        console.error("Failed to create checkout:", result.error);
        resolve(false);
        return;
      }

      // Open checkout in new window
      const checkoutWindow = window.open(
        result.checkoutUrl,
        'stripe-checkout',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!checkoutWindow) {
        console.error("Failed to open checkout window");
        resolve(false);
        return;
      }

      // Listen for the window to close or navigate back
      const checkClosed = setInterval(() => {
        if (checkoutWindow.closed) {
          clearInterval(checkClosed);
          // Check if we have a session ID in the URL (success case)
          const urlParams = new URLSearchParams(window.location.search);
          const sessionId = urlParams.get('session_id');
          
          if (sessionId) {
            // Call boost function with session ID
            boostWish(options.wishId, options.who, sessionId)
              .then(() => resolve(true))
              .catch(() => resolve(false));
          } else {
            resolve(false);
          }
        }
      }, 1000);

      // Timeout after 10 minutes
      setTimeout(() => {
        clearInterval(checkClosed);
        if (!checkoutWindow.closed) {
          checkoutWindow.close();
        }
        resolve(false);
      }, 600000);

    } catch (error) {
      console.error("Error in openBoostCheckout:", error);
      resolve(false);
    }
  });
}
