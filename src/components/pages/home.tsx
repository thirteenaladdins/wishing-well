import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  // Initialize session token
  useEffect(() => {
    let token = localStorage.getItem("wishing_well_session");
    if (!token) {
      token = "session_" + Math.random().toString(36).substr(2, 9) + Date.now();
      localStorage.setItem("wishing_well_session", token);
    }

    const freeWishUsed = localStorage.getItem("free_wish_used") === "true";
    const purchasedWishes = parseInt(
      localStorage.getItem("purchased_wishes") || "0",
    );

    setSessionData({
      token,
      free_wish_used: freeWishUsed,
      purchased_wishes: purchasedWishes,
    });
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

  // Submit new wish
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

    if (sessionData.free_wish_used && sessionData.purchased_wishes <= 0) {
      toast({
        title: "No wishes available",
        description:
          "You've used your free wish. Purchase more wishes to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("wishes").insert({
        content: newWish.trim(),
        session_token: sessionData.token,
        boost_count: 0,
      });

      if (error) throw error;

      // Update session data
      if (!sessionData.free_wish_used) {
        localStorage.setItem("free_wish_used", "true");
        setSessionData((prev) => ({ ...prev, free_wish_used: true }));
      } else {
        const newCount = sessionData.purchased_wishes - 1;
        localStorage.setItem("purchased_wishes", newCount.toString());
        setSessionData((prev) => ({ ...prev, purchased_wishes: newCount }));
      }

      setNewWish("");
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
      const { error } = await supabase.rpc("boost_wish", { wish_id: wishId });

      if (error) throw error;

      // Update session data
      if (!sessionData.free_wish_used) {
        localStorage.setItem("free_wish_used", "true");
        setSessionData((prev) => ({ ...prev, free_wish_used: true }));
      } else {
        const newCount = sessionData.purchased_wishes - 1;
        localStorage.setItem("purchased_wishes", newCount.toString());
        setSessionData((prev) => ({ ...prev, purchased_wishes: newCount }));
      }

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
    setIsPurchasing(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-create-checkout",
        {
          body: {
            price_id: "price_wishes_10_pack", // This would be configured in Stripe
            session_token: sessionData.token,
            return_url: window.location.origin,
          },
        },
      );

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

  const canMakeWish =
    !sessionData.free_wish_used || sessionData.purchased_wishes > 0;
  const wishesRemaining = sessionData.free_wish_used
    ? sessionData.purchased_wishes
    : 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Wand2 className="h-8 w-8 text-purple-600" />
                <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Wishing Well
                </h1>
                <p className="text-sm text-gray-600">
                  Make your dreams come true
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-purple-100 rounded-full px-3 py-1">
                <Coins className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">
                  {wishesRemaining} wish{wishesRemaining !== 1 ? "es" : ""} left
                </span>
              </div>

              {user ? (
                <Link to="/dashboard">
                  <Button variant="outline" size="sm">
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <div className="flex space-x-2">
                  <Link to="/login">
                    <Button variant="ghost" size="sm">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button size="sm">Sign Up</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Wish Input Section */}
        <div className="max-w-2xl mx-auto mb-12">
          <Card className="bg-white/70 backdrop-blur-sm border-purple-200 shadow-lg">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                  Make a Wish
                </h2>
                <p className="text-gray-600">
                  Share your dreams with the world. Each wish can be boosted by
                  others to make it glow brighter.
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Input
                    placeholder="What do you wish for? (200 characters max)"
                    value={newWish}
                    onChange={(e) => setNewWish(e.target.value)}
                    maxLength={200}
                    className="pr-16 text-lg py-3 border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                    disabled={!canMakeWish}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-400">
                    {newWish.length}/200
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleSubmitWish}
                    disabled={!canMakeWish || !newWish.trim() || isSubmitting}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Star className="mr-2 h-4 w-4" />
                        Make Wish
                      </>
                    )}
                  </Button>

                  {!canMakeWish && (
                    <Button
                      onClick={handlePurchaseWishes}
                      disabled={isPurchasing}
                      variant="outline"
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                    >
                      {isPurchasing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Buy 10 Wishes - £1
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {!canMakeWish && (
                  <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-yellow-800 text-sm">
                      You've used your free wish! Purchase more wishes to
                      continue making and boosting wishes.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Wishes Wall */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Community Wishes
            </h3>
            <p className="text-gray-600">
              Boost wishes you believe in to help them glow brighter and rise to
              the top
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" />
              <p className="text-gray-600 mt-2">Loading wishes...</p>
            </div>
          ) : wishes.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg">
                No wishes yet. Be the first to make a wish!
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {wishes.map((wish) => (
                <Card
                  key={wish.id}
                  className={`bg-white/80 backdrop-blur-sm border-purple-200 hover:border-purple-300 transition-all duration-300 ${getWishGlow(wish.boost_count)}`}
                >
                  <CardContent className="p-4">
                    <div className="mb-3">
                      <p className="text-gray-800 leading-relaxed">
                        {wish.content}
                      </p>
                    </div>

                    <Separator className="my-3" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="secondary"
                          className="bg-purple-100 text-purple-700 hover:bg-purple-200"
                        >
                          <Zap className="h-3 w-3 mr-1" />
                          {wish.boost_count} boost
                          {wish.boost_count !== 1 ? "s" : ""}
                        </Badge>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleBoostWish(wish.id)}
                        disabled={!canMakeWish}
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                      >
                        <Heart className="h-4 w-4 mr-1" />
                        Boost
                      </Button>
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      {new Date(wish.created_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Purchase Section */}
        {sessionData.free_wish_used && sessionData.purchased_wishes <= 3 && (
          <div className="max-w-2xl mx-auto mt-12">
            <Card className="bg-gradient-to-r from-purple-100 to-pink-100 border-purple-200">
              <CardContent className="p-6 text-center">
                <Coins className="h-12 w-12 mx-auto text-purple-600 mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Need More Wishes?
                </h3>
                <p className="text-gray-600 mb-4">
                  Get 10 more wishes for just £1. Support the community and keep
                  the magic alive!
                </p>
                <Button
                  onClick={handlePurchaseWishes}
                  disabled={isPurchasing}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  {isPurchasing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Buy 10 Wishes - £1
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <Toaster />
    </div>
  );
}
