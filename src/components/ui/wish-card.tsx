import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Wish } from "@/lib/api/fetchWishes";
import { Zap, Heart, Clock, Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface WishCardProps {
  wish: Wish;
  onBoost?: (wishId: string) => Promise<void>;
  canBoost?: boolean;
  isBoosting?: boolean;
  showScore?: boolean;
  showRecentBoosts?: boolean;
  className?: string;
  isTopWish?: boolean;
  shouldFlash?: boolean;
}

export function WishCard({ 
  wish, 
  onBoost, 
  canBoost = true, 
  isBoosting = false,
  showScore = false,
  showRecentBoosts = false,
  className = "",
  isTopWish = false,
  shouldFlash = false
}: WishCardProps) {
  const { toast } = useToast();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isTopPulsing, setIsTopPulsing] = useState(false);

  // Trigger pulse animation when shouldFlash is true
  useEffect(() => {
    if (shouldFlash) {
      setIsTopPulsing(true);
      const timer = setTimeout(() => {
        setIsTopPulsing(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [shouldFlash]);

  const handleBoost = async () => {
    if (!onBoost || !canBoost || isBoosting) return;

    try {
      await onBoost(wish.id);
      
      // Trigger pulse animation
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);
    } catch (error: any) {
      // Re-throw the error so the parent component can handle the toast
      throw error;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const getWishGlow = (boostCount: number) => {
    if (boostCount === 0) return "";
    if (boostCount < 5) return "shadow-md shadow-yellow-200/50";
    if (boostCount < 10) return "shadow-lg shadow-yellow-300/60 ring-1 ring-yellow-200";
    if (boostCount < 20) return "shadow-xl shadow-yellow-400/70 ring-2 ring-yellow-300";
    return "shadow-2xl shadow-yellow-500/80 ring-4 ring-yellow-400";
  };

  const getBoostButtonVariant = (boostCount: number) => {
    if (boostCount >= 100) return "default"; // Legends
    if (boostCount >= 20) return "secondary";
    return "ghost";
  };

  return (
    <Card 
      className={cn(
        "bg-white/80 backdrop-blur-sm hover:bg-white/90 transition-all duration-200",
        getWishGlow(wish.boosts),
        isAnimating && "animate-pulse",
        isTopPulsing && "animate-pulse",
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Wish content */}
          <div className="flex-1 min-w-0">
            <p className="text-gray-800 leading-relaxed text-base break-words">
              🌙 "{wish.text}"
            </p>
            
            {/* Additional info for specific tabs */}
            {showScore && wish.score !== undefined && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <TrendingUp className="h-4 w-4" />
                <span>Score: {wish.score.toFixed(2)}</span>
              </div>
            )}
            
            {showRecentBoosts && wish.recent_boosts_count !== undefined && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <Zap className="h-4 w-4 text-orange-500" />
                <span>{wish.recent_boosts_count} boosts in 24h</span>
              </div>
            )}
          </div>

          {/* Boost section */}
          <div className="flex flex-col items-end gap-2">
            {/* Boost count and button */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">{wish.boosts}</span>
              </div>
              
              <Button
                size="sm"
                variant={getBoostButtonVariant(wish.boosts)}
                onClick={handleBoost}
                disabled={!canBoost || isBoosting}
                className={cn(
                  "h-8 px-3",
                  wish.boosts >= 100 && "bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-white",
                  wish.boosts >= 20 && wish.boosts < 100 && "bg-yellow-100 hover:bg-yellow-200 text-yellow-800",
                  wish.boosts < 20 && "text-red-500 hover:text-red-600 hover:bg-red-50"
                )}
              >
                {isBoosting ? (
                  <Heart className="h-4 w-4 animate-pulse" />
                ) : (
                  <Heart className="h-4 w-4" />
                )}
                <span className="ml-1 hidden sm:inline">
                  {wish.boosts >= 100 ? "Legend" : "Boost"}
                </span>
              </Button>
            </div>

            {/* Timestamp */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>{formatTimestamp(wish.created_at)}</span>
            </div>

            {/* Legend badge */}
            {wish.boosts >= 100 && (
              <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-xs">
                <Star className="h-3 w-3 mr-1" />
                Legend
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
