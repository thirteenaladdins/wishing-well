# Virtual Wishing Well - Feed Tabs Implementation

This implementation adds feed tabs (Hot/New/Top/Rising/Legends) and secure boost functionality to the Virtual Wishing Well project.

## Features Implemented

### 1. Database Structure
- **Migration**: `20250101000000_implement_feed_tabs_and_boosts.sql`
- **New Table**: `wishes_boosts` for tracking individual boost actions
- **Updated Table**: `wishes` with new columns (`text`, `boosts`, `is_public`, `flagged`)
- **Views**: `wishes_hot`, `wishes_new`, `wishes_top`, `wishes_legends`, `wishes_rising`
- **Function**: `boost_wish(p_wish_id, p_who)` for atomic boost operations

### 2. API Functions
- **File**: `src/lib/api/fetchWishes.ts`
- **Functions**: `fetchWishes()`, `fetchWishesByTab()`, helper functions for tab display
- **Types**: `Wish`, `WishTab`, `FetchWishesOptions`

### 3. UI Components
- **FeedTabs**: `src/components/ui/feed-tabs.tsx` - Tab switcher with icons and descriptions
- **WishCard**: `src/components/ui/wish-card.tsx` - Enhanced wish display with boost functionality

### 4. Stripe Integration
- **File**: `src/lib/stripe.ts`
- **Functions**: `createBoostCheckout()`, `boostWish()`, `openBoostCheckout()`
- **Edge Function**: `supabase/functions/boost/index.ts` - Secure server-side boost processing

### 5. Updated Pages
- **Wishes Feed**: `src/components/pages/wishes.tsx` - Now uses feed tabs and new components

## Tab Types

1. **Hot** - Time-decayed score with 48h half-life
2. **New** - Latest wishes first
3. **Top** - Most boosted wishes overall
4. **Rising** - Wishes gaining momentum in last 24h
5. **Legends** - Wishes with 100+ boosts

## Security Features

- **Rate Limiting**: Prevents same user from boosting same wish within 60 seconds
- **Stripe Verification**: Server-side payment verification before processing boosts
- **RLS Policies**: Row-level security on all tables
- **Server-side Processing**: All boost operations go through Edge Functions

## Environment Variables Required

```env
# Client-side
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PRICE_ID=price_wishes_10_pack
VITE_STRIPE_BOOST_PRICE_ID=price_boost_10p

# Server-side (Edge Functions)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
STRIPE_SECRET_KEY=your_stripe_secret_key
ALLOWED_ORIGIN=http://localhost:5173
```

## Setup Instructions

1. **Run Database Migration**:
   ```bash
   npx supabase db reset
   # or
   npx supabase migration up
   ```

2. **Deploy Edge Functions**:
   ```bash
   npx supabase functions deploy boost
   ```

3. **Set Environment Variables**:
   - Copy the example environment variables above
   - Update with your actual Supabase and Stripe credentials

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

## Key Features

- **Real-time Updates**: Wishes update automatically when boosted
- **Payment Integration**: Seamless Stripe checkout for boost purchases
- **Responsive Design**: Works on mobile and desktop
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Loading States**: Visual feedback during operations
- **Animations**: Pulse effects and smooth transitions

## Database Views Explained

- **wishes_hot**: Uses exponential decay formula for time-based scoring
- **wishes_new**: Simple chronological ordering
- **wishes_top**: Ordered by total boost count
- **wishes_rising**: Shows wishes gaining momentum in last 24 hours
- **wishes_legends**: Special view for highly boosted wishes (100+)

## Boost Flow

1. User clicks boost button
2. Check if user has available wishes
3. If no wishes: Open Stripe checkout for purchase
4. If has wishes: Call boost function directly
5. Server verifies payment (if applicable) and processes boost
6. Real-time update of wish display
7. User sees confirmation and updated boost count

This implementation provides a complete, production-ready feed system with secure payment processing and real-time updates.
