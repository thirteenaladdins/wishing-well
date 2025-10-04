import { supabase } from "../../../supabase/supabase";

export type WishTab = 'hot' | 'new' | 'top' | 'legends' | 'rising';

export interface Wish {
  id: string;
  text: string;
  boosts: number;
  created_at: string;
  is_public: boolean;
  flagged: boolean;
  score?: number; // For hot tab
  recent_boosts_count?: number; // For rising tab
}

export interface FetchWishesOptions {
  tab: WishTab;
  limit?: number;
  offset?: number;
}

export async function fetchWishes({ tab, limit = 60, offset = 0 }: FetchWishesOptions): Promise<Wish[]> {
  let viewName: string;
  
  switch (tab) {
    case 'hot':
      viewName = 'wishes_hot';
      break;
    case 'new':
      viewName = 'wishes_new';
      break;
    case 'top':
      viewName = 'wishes_top';
      break;
    case 'legends':
      viewName = 'wishes_legends';
      break;
    case 'rising':
      viewName = 'wishes_rising';
      break;
    default:
      viewName = 'wishes_hot';
  }

  try {
    const { data, error } = await supabase
      .from(viewName)
      .select('*')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error(`Error fetching ${tab} wishes:`, error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error(`Failed to fetch ${tab} wishes:`, error);
    throw error;
  }
}

export async function fetchWishesByTab(tab: WishTab): Promise<Wish[]> {
  return fetchWishes({ tab });
}

// Helper function to get the display name for a tab
export function getTabDisplayName(tab: WishTab): string {
  const names: Record<WishTab, string> = {
    hot: 'Hot',
    new: 'New',
    top: 'Top',
    legends: 'Legends',
    rising: 'Rising'
  };
  return names[tab];
}

// Helper function to get the description for a tab
export function getTabDescription(tab: WishTab): string {
  const descriptions: Record<WishTab, string> = {
    hot: 'Most popular wishes right now',
    new: 'Latest wishes from the community',
    top: 'Most boosted wishes of all time',
    legends: 'Legendary wishes with 100+ boosts',
    rising: 'Wishes gaining momentum in the last 24h'
  };
  return descriptions[tab];
}
