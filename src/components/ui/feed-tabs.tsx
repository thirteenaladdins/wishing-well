import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { WishTab, getTabDisplayName, getTabDescription } from "@/lib/api/fetchWishes";
import { Flame, Clock, Trophy, Crown, TrendingUp } from "lucide-react";

interface FeedTabsProps {
  activeTab: WishTab;
  onTabChange: (tab: WishTab) => void;
  wishCounts?: Partial<Record<WishTab, number>>;
  className?: string;
}

const tabIcons: Record<WishTab, React.ComponentType<{ className?: string }>> = {
  hot: Flame,
  new: Clock,
  top: Trophy,
  legends: Crown,
  rising: TrendingUp,
};

export function FeedTabs({ 
  activeTab, 
  onTabChange, 
  wishCounts = {}, 
  className = "" 
}: FeedTabsProps) {
  const tabs: WishTab[] = ['hot', 'new', 'top', 'rising', 'legends'];

  return (
    <div className={`w-full ${className}`}>
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as WishTab)}>
        <TabsList className="grid w-full grid-cols-5 bg-white/20 backdrop-blur-sm border border-white/30">
          {tabs.map((tab) => {
            const Icon = tabIcons[tab];
            const count = wishCounts[tab];
            
            return (
              <TabsTrigger
                key={tab}
                value={tab}
                className="flex items-center space-x-2 text-white data-[state=active]:bg-white/30 data-[state=active]:text-white"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{getTabDisplayName(tab)}</span>
                {count !== undefined && (
                  <Badge 
                    variant="secondary" 
                    className="ml-1 bg-white/20 text-white border-white/30"
                  >
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
        
        {tabs.map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white drop-shadow-lg mb-1">
                {getTabDisplayName(tab)}
              </h3>
              <p className="text-sm text-white/80 drop-shadow-lg">
                {getTabDescription(tab)}
              </p>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
