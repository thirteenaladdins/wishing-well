import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { supabase } from "../../../supabase/supabase";
import { useAuth } from "../../../supabase/auth";
import {
  Heart,
  Sparkles,
  Star,
  Coins,
  Zap,
  Plus,
  ShoppingCart,
  Loader2,
  Wand2,
} from "lucide-react";
import { Link } from "react-router-dom";

interface Wish {
  id: string;
  content: string;
  boost_count: number;
  created_at: string;
  session_token: string;
}

interface SessionData {
  token: string;
  free_wish_used: boolean;
  purchased_wishes: number;
}

export default function WishingWell() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [newWish, setNewWish] = useState("");
  const [sessionData, setSessionData] = useState<SessionData>({
    token: "",
    free_wish_used: false,
    purchased_wishes: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [showRipple, setShowRipple] = useState(false);

  // Refresh session data from server
  const refreshSessionData = async (token?: string) => {
    const sessionToken = token || sessionData.token;
    if (!sessionToken) return;

    try {
      const { data, error } = await supabase
        .rpc("get_or_create_session", { session_token_param: sessionToken });

      if (error) throw error;

      const sessionArray = Array.isArray(data) ? data : data ? [data] : [];

      if (sessionArray.length > 0) {
        const session = sessionArray[0];
        setSessionData({
          token: sessionToken,
          free_wish_used: session.free_wish_used,
          purchased_wishes: session.purchased_wishes,
        });
      }
      setSessionLoaded(true);
    } catch (error) {
      console.error("Error refreshing session data:", error);
      setSessionLoaded(true);
    }
  };

  // Initialize session token
  useEffect(() => {
    let token = localStorage.getItem("wishing_well_session");
    if (!token) {
      token = "session_" + Math.random().toString(36).substr(2, 9) + Date.now();
      localStorage.setItem("wishing_well_session", token);
    }

    setSessionData({
      token,
      free_wish_used: false,
      purchased_wishes: 0,
    });
    setSessionLoaded(false);

    refreshSessionData(token);
  }, []);

  // Refresh session data when returning from success page
  useEffect(() => {
    const handleFocus = () => {
      // Refresh session data when user returns to the page
      refreshSessionData();
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Fetch wishes from database
  const fetchWishes = async () => {
    try {
      const { data, error } = await supabase
        .from("wishes")
        .select("*")
        .order("boost_count", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWishes(data || []);
    } catch (error) {
      console.error("Error fetching wishes:", error);
      toast({
        title: "Error",
        description: "Failed to load wishes. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishes();

    // Set up real-time subscription
    const channel = supabase
      .channel("wishes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wishes" },
        () => {
          fetchWishes();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Submit new wish with server-side validation
  const handleSubmitWish = async () => {
    if (!newWish.trim()) {
      toast({
        title: "Empty wish",
        description: "Please enter your wish before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (newWish.length > 200) {
      toast({
        title: "Wish too long",
        description: "Please keep your wish under 200 characters.",
        variant: "destructive",
      });
      return;
    }

    if (!sessionData.token) {
      toast({
        title: "Session error",
        description: "Unable to identify your session. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    if (!sessionLoaded) {
      toast({
        title: "Loading session",
        description: "Please wait while we confirm your remaining wishes.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.rpc("make_wish", {
        session_token_param: sessionData.token,
        wish_content: newWish.trim(),
      });

      if (error) {
        if (error.message?.includes("No wishes available")) {
          toast({
            title: "No wishes available",
            description:
              "You've used your free wish. Purchase more wishes to continue.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      await refreshSessionData();

      setNewWish("");
      
      // Show ripple animation
      setShowRipple(true);
      setTimeout(() => setShowRipple(false), 2000);
      
      toast({
        title: "Wish submitted!",
        description: "Your wish has been added to the wishing well.",
      });
    } catch (error) {
      console.error("Error submitting wish:", error);
      toast({
        title: "Error",
        description: "Failed to submit your wish. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Boost existing wish
  const handleBoostWish = async (wishId: string) => {
    if (!sessionData.token) {
      toast({
        title: "Session error",
        description: "Unable to identify your session. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    if (!sessionLoaded) {
      toast({
        title: "Loading session",
        description: "Please wait while we confirm your remaining wishes.",
        variant: "destructive",
      });
      return;
    }

    if (sessionData.free_wish_used && sessionData.purchased_wishes <= 0) {
      toast({
        title: "No wishes available",
        description:
          "You need wishes to boost. Purchase more wishes to continue.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.rpc("boost_wish", {
        wish_id: wishId,
        session_token_param: sessionData.token,
      });

      if (error) {
        if (error.message?.includes("No wishes available")) {
          toast({
            title: "No wishes available",
            description:
              "You need wishes to boost. Purchase more wishes to continue.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      await refreshSessionData();

      toast({
        title: "Wish boosted!",
        description: "You've added power to this wish.",
      });
    } catch (error) {
      console.error("Error boosting wish:", error);
      toast({
        title: "Error",
        description: "Failed to boost wish. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Purchase wishes via Stripe
  const handlePurchaseWishes = async () => {
    if (isPurchasing) return;
    if (!sessionData.token) {
      toast({
        title: "Session error",
        description: "Unable to identify your session. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    if (!sessionLoaded) {
      toast({
        title: "Loading session",
        description: "Please wait while we confirm your remaining wishes.",
        variant: "destructive",
      });
      return;
    }

    setIsPurchasing(true);

    try {
      const priceId = import.meta.env.VITE_STRIPE_PRICE_ID || "price_wishes_10_pack";
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          price_id: priceId,
          session_token: sessionData.token,
          return_url: window.location.origin,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast({
        title: "Purchase failed",
        description: "Unable to process purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  // Calculate wish glow intensity based on boost count
  const getWishGlow = (boostCount: number) => {
    if (boostCount === 0) return "";
    if (boostCount < 5) return "shadow-md shadow-yellow-200/50";
    if (boostCount < 10)
      return "shadow-lg shadow-yellow-300/60 ring-1 ring-yellow-200";
    if (boostCount < 20)
      return "shadow-xl shadow-yellow-400/70 ring-2 ring-yellow-300";
    return "shadow-2xl shadow-yellow-500/80 ring-4 ring-yellow-400 animate-pulse";
  };

  const hasWishes =
    !sessionData.free_wish_used || sessionData.purchased_wishes > 0;
  const canMakeWish = sessionLoaded && hasWishes;
  const wishesRemaining = sessionLoaded
    ? sessionData.free_wish_used
      ? sessionData.purchased_wishes
      : 1
    : null;

  return (
    <div 
      className="min-h-screen relative flex flex-col"
      style={{
        background: "url('/grass-background.png') no-repeat center center, linear-gradient(to bottom, #87CEEB, #98FB98)",
        backgroundSize: "cover",
        backgroundAttachment: "fixed"
      }}
    >
      {/* Header - Minimal */}
      <header className="bg-transparent relative z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Wand2 className="h-8 w-8 text-white drop-shadow-lg" />
                <Sparkles className="h-4 w-4 text-yellow-300 absolute -top-1 -right-1 drop-shadow-lg" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                  Wishing Well
                </h1>
                <p className="text-sm text-white/90 drop-shadow-lg">
                  Make your dreams come true
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 border border-white/30">
                <Coins className="h-4 w-4 text-yellow-300" />
                <span className="text-sm font-medium text-white drop-shadow-lg">
                  {sessionLoaded ? (
                    <>
                      {wishesRemaining} wish{wishesRemaining !== 1 ? "es" : ""} left
                    </>
                  ) : (
                    "Checking wishes..."
                  )}
                </span>
              </div>

              <Link to="/wishes">
                <Button variant="outline" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                  ✨ See what others are wishing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* The Well */}
      <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 z-20">
        <img 
          src="/wishing-well-asset.png" 
          alt="Wishing Well" 
          className="w-full h-full object-contain"
          onLoad={() => console.log('Well image loaded successfully')}
          onError={(e) => {
            console.log('Image failed to load:', e);
          }}
        />
      </div>

      {/* Main Well Area */}
      <main className="flex-1 flex flex-col items-center justify-end px-4 relative z-10 pb-16">
        {/* Magical sparkles */}
        <div className="relative mb-8">
          <div className="flex items-center justify-center space-x-8">
            <Sparkles className="h-8 w-8 text-yellow-300 animate-pulse" />
            <Star className="h-6 w-6 text-yellow-400 animate-bounce" />
            <Sparkles className="h-7 w-7 text-purple-300 animate-pulse" />
            <Star className="h-5 w-5 text-pink-300 animate-bounce" />
          </div>
        </div>

        {/* Wish Input Section */}
        <div className="max-w-md w-full">
          <Card className="bg-white/80 backdrop-blur-sm border-purple-200 shadow-xl">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Make a Wish
                </h2>
                <p className="text-gray-600">
                  Whisper your deepest desire into the well
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Textarea
                    placeholder="What do you wish for?"
                    value={newWish}
                    onChange={(e) => setNewWish(e.target.value)}
                    maxLength={200}
                    className="pr-16 text-base py-3 border-purple-200 focus:border-purple-400 focus:ring-purple-400 resize-none min-h-[50px] max-h-[120px]"
                    disabled={!sessionLoaded || !hasWishes}
                    rows={2}
                    style={{
                      height: 'auto',
                      overflow: 'hidden'
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                    }}
                  />
                  <div className="absolute right-3 top-3 text-sm text-gray-400">
                    {newWish.length}/200
                  </div>
                </div>

                <Button
                  onClick={handleSubmitWish}
                  disabled={!sessionLoaded || !hasWishes || !newWish.trim() || isSubmitting}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 text-lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Making wish...
                    </>
                  ) : (
                    <>
                      <Star className="mr-2 h-5 w-5" />
                      ★ Make Wish
                    </>
                  )}
                </Button>

                {sessionLoaded && !hasWishes && (
                  <div className="space-y-3">
                    <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-yellow-800 text-sm">
                        You've used your free wish! Purchase more wishes to continue.
                      </p>
                    </div>
                    <Button
                      onClick={handlePurchaseWishes}
                      disabled={isPurchasing}
                      variant="outline"
                      className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                    >
                      {isPurchasing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          {import.meta.env.DEV || window.location.hostname === 'localhost' 
                            ? 'Buy 10 Wishes - £1 (Dev Mode)' 
                            : 'Buy 10 Wishes - £1'}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Toaster />
    </div>
  );
}
