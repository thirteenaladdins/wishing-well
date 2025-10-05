import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface BoostRequest {
  wishId: string;
  who?: string;
  sessionId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { wishId, who, sessionId }: BoostRequest = await req.json()

    if (!wishId) {
      return new Response(
        JSON.stringify({ error: 'wishId is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // If sessionId is provided, verify Stripe Checkout Session
    if (sessionId) {
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
        apiVersion: '2023-10-16',
      })

      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId)
        
        if (session.payment_status !== 'paid') {
          return new Response(
            JSON.stringify({ error: 'Payment not completed' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        // Add purchased wishes to the session
        const { error: addWishesError } = await supabaseClient.rpc('add_purchased_wishes', {
          session_token_param: session.metadata?.session_token || who || 'anonymous',
          wishes_to_add: 10 // Assuming 10 wishes per purchase
        })

        if (addWishesError) {
          console.error('Error adding purchased wishes:', addWishesError)
          return new Response(
            JSON.stringify({ error: 'Failed to process payment' }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
      } catch (stripeError) {
        console.error('Stripe verification error:', stripeError)
        return new Response(
          JSON.stringify({ error: 'Payment verification failed' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Rate limiting: Check if the same 'who' boosted the same wish in the last 60 seconds
    if (who) {
      const { data: recentBoosts, error: rateLimitError } = await supabaseClient
        .from('wishes_boosts')
        .select('id')
        .eq('wish_id', wishId)
        .eq('who', who)
        .gte('created_at', new Date(Date.now() - 60000).toISOString())
        .limit(1)

      if (rateLimitError) {
        console.error('Rate limit check error:', rateLimitError)
        return new Response(
          JSON.stringify({ error: 'Rate limit check failed' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      if (recentBoosts && recentBoosts.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Rate limited: Please wait before boosting again' }),
          { 
            status: 429, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Call the boost_wish function that consumes wishes
    const { error: boostError } = await supabaseClient.rpc('boost_wish', {
      wish_id: wishId,
      session_token_param: who || 'anonymous'
    })

    if (boostError) {
      console.error('Boost error:', boostError)
      return new Response(
        JSON.stringify({ error: 'Failed to boost wish' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
