import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { FeedTabs } from "@/components/ui/feed-tabs";
import { WishCard } from "@/components/ui/wish-card";
import { supabase } from "../../../supabase/supabase";
import { useAuth } from "../../../supabase/auth";
import { fetchWishes, Wish, WishTab } from "@/lib/api/fetchWishes";
import { boostWish, openBoostCheckout } from "@/lib/stripe";
import {
  Sparkles,
  Star,
  Coins,
  ArrowLeft,
  Loader2,
  Wand2,
} from "lucide-react";
import { Link } from "react-router-dom";

interface SessionData {
  token: string;
  free_wish_used: boolean;
  purchased_wishes: number;
}

export default function WishesFeed() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [activeTab, setActiveTab] = useState<WishTab>('hot');
  const [sessionData, setSessionData] = useState<SessionData>({
    token: "",
    free_wish_used: false,
    purchased_wishes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [boostingWishId, setBoostingWishId] = useState<string | null>(null);
  const [topWishesSeen, setTopWishesSeen] = useState<Set<string>>(new Set());

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

  // Initialize session token and load top wishes seen
  useEffect(() => {
    let token = localStorage.getItem("wishing_well_session");
    if (!token) {
      token = "session_" + Math.random().toString(36).substr(2, 9) + Date.now();
      localStorage.setItem("wishing_well_session", token);
    }

    // Load previously seen top wishes
    const savedTopWishes = localStorage.getItem("wishing_well_top_wishes_seen");
    if (savedTopWishes) {
      try {
        const topWishesArray = JSON.parse(savedTopWishes);
        setTopWishesSeen(new Set(topWishesArray));
      } catch (error) {
        console.error("Error loading top wishes seen:", error);
      }
    }

    setSessionData({
      token,
      free_wish_used: false,
      purchased_wishes: 0,
    });
    setSessionLoaded(false);

    refreshSessionData(token);
  }, []);

  // Fetch wishes from database
  const fetchWishesData = async (tab: WishTab = activeTab) => {
    try {
      setLoading(true);
      const data = await fetchWishes({ tab, limit: 60 });
      setWishes(data);
      
      // Track the current top wish
      if (data.length > 0 && tab !== 'new') {
        const currentTopWishId = data[0].id;
        setTopWishesSeen(prev => {
          const newSet = new Set(prev).add(currentTopWishId);
          // Save to localStorage
          localStorage.setItem("wishing_well_top_wishes_seen", JSON.stringify([...newSet]));
          return newSet;
        });
      }
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
    fetchWishesData(activeTab);

    // Set up real-time subscription
    const channel = supabase
      .channel("wishes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wishes" },
        () => {
          fetchWishesData(activeTab);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  // Handle tab change
  const handleTabChange = (tab: WishTab) => {
    setActiveTab(tab);
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

    const hasWishes = !sessionData.free_wish_used || sessionData.purchased_wishes > 0;

    if (!hasWishes) {
      // Open Stripe checkout for boost purchase
      setBoostingWishId(wishId);
      try {
        const success = await openBoostCheckout({
          wishId,
          who: sessionData.token,
          returnUrl: window.location.href
        });
        
        if (success) {
          await refreshSessionData();
          await fetchWishesData(activeTab);
        }
      } catch (error) {
        console.error("Error with boost checkout:", error);
        toast({
          title: "Purchase failed",
          description: "Unable to process boost purchase. Please try again.",
          variant: "destructive",
        });
      } finally {
        setBoostingWishId(null);
      }
      return;
    }

    try {
      setBoostingWishId(wishId);
      await boostWish(wishId, sessionData.token);
      await refreshSessionData();
      await fetchWishesData(activeTab);
      
      // Show success toast
      toast({
        title: "Wish boosted!",
        description: "You've added power to this wish.",
      });
    } catch (error: any) {
      console.error("Error boosting wish:", error);
      
      // Check if it's a rate limit error
      const isRateLimited = error.message?.includes("60 seconds") || 
                           error.message?.includes("Rate limited") ||
                           error.message?.includes("Please wait") ||
                           error.message?.includes("boost the same wish");
      
      toast({
        title: isRateLimited ? "Please wait" : "Error",
        description: error.message || "Failed to boost wish. Please try again.",
        variant: isRateLimited ? "default" : "destructive",
      });
    } finally {
      setBoostingWishId(null);
    }
  };

  const hasWishes = !sessionData.free_wish_used || sessionData.purchased_wishes > 0;

  return (
    <div 
      className="min-h-screen relative"
      style={{
        background: "url('/grass-background.png') no-repeat center center, linear-gradient(to bottom, #87CEEB, #98FB98)",
        backgroundSize: "cover",
        backgroundAttachment: "fixed"
      }}
    >
      {/* The Well */}
      <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 z-10">
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

      {/* Header */}
      <header className="bg-transparent relative z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link to="/">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Return to the well
                </Button>
              </Link>
            </div>

            <div className="flex items-center space-x-3">
              <div className="relative">
                <Wand2 className="h-8 w-8 text-white drop-shadow-lg" />
                <Sparkles className="h-4 w-4 text-yellow-300 absolute -top-1 -right-1 drop-shadow-lg" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                  Community Wishes
                </h1>
                <p className="text-sm text-white/90 drop-shadow-lg">
                  Boost wishes you believe in
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 border border-white/30">
              <Coins className="h-4 w-4 text-yellow-300" />
              <span className="text-sm font-medium text-white drop-shadow-lg">
                {sessionLoaded ? (
                  <>
                    {hasWishes ? (sessionData.free_wish_used ? sessionData.purchased_wishes : 1) : 0} wish{hasWishes ? (sessionData.free_wish_used ? sessionData.purchased_wishes : 1) !== 1 ? "es" : "" : "es"} left
                  </>
                ) : (
                  "Checking wishes..."
                )}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8 relative z-20 mt-32">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white drop-shadow-lg mb-2">
            Community Wishes
          </h2>
          <p className="text-white/90 drop-shadow-lg">
            Boost wishes you believe in to help them glow brighter and rise to the top
          </p>
        </div>

        {/* Feed Tabs */}
        <div className="max-w-4xl mx-auto mb-8">
          <FeedTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            className="mb-6"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-white" />
            <p className="text-white/90 mt-2 drop-shadow-lg">Loading wishes...</p>
          </div>
        ) : wishes.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto text-white/60 mb-4 drop-shadow-lg" />
            <p className="text-white/90 text-lg drop-shadow-lg">
              No wishes yet. Be the first to make a wish!
            </p>
            <Link to="/">
              <Button className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                <Star className="mr-2 h-4 w-4" />
                Make the first wish
              </Button>
            </Link>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {wishes.map((wish, index) => (
              <WishCard
                key={wish.id}
                wish={wish}
                onBoost={handleBoostWish}
                canBoost={sessionLoaded && hasWishes}
                isBoosting={boostingWishId === wish.id}
                showScore={activeTab === 'hot'}
                showRecentBoosts={activeTab === 'rising'}
                isTopWish={index === 0 && activeTab !== 'new'}
                hasBeenTopBefore={topWishesSeen.has(wish.id)}
              />
            ))}
          </div>
        )}
      </main>

      <Toaster />
    </div>
  );
}
