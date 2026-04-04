export default {
  async fetch(request, env) {
    const ALLOWED_ORIGIN = 'https://alexanderkunkel748.github.io';

    // CORS
    if (request.method === 'OPTIONS') {
      return new Response('', {
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST'
        }
      });
    }

    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN
    };

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    // ============================================
    // ROUTE 1: Stripe Checkout Session erstellen
    // ============================================
    if (url.pathname === '/create-session') {
      try {
        const { prompt } = await request.json();

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
          return new Response(JSON.stringify({ error: 'Kein Prompt angegeben' }), {
            status: 400, headers: corsHeaders
          });
        }

        if (prompt.length > 5000) {
          return new Response(JSON.stringify({ error: 'Prompt zu lang (max 5000 Zeichen)' }), {
            status: 400, headers: corsHeaders
          });
        }

        // Stripe Checkout Session erstellen
        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            'mode': 'payment',
            'line_items[0][price]': env.STRIPE_PRICE_ID,
            'line_items[0][quantity]': '1',
            'success_url': 'https://alexanderkunkel748.github.io/agentier/promptinator.html?session_id={CHECKOUT_SESSION_ID}',
            'cancel_url': 'https://alexanderkunkel748.github.io/agentier/promptinator.html?cancelled=true'
          })
        });

        const session = await stripeResponse.json();

        if (session.error) {
          return new Response(JSON.stringify({ error: 'Zahlung konnte nicht erstellt werden' }), {
            status: 500, headers: corsHeaders
          });
        }

        return new Response(JSON.stringify({ url: session.url }), {
          headers: corsHeaders
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: corsHeaders
        });
      }
    }

    // ============================================
    // ROUTE 2: Prompt optimieren (nach Zahlung)
    // ============================================
    if (url.pathname === '/optimize') {
      try {
        const { prompt, sessionId } = await request.json();

        // Input-Validierung
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
          return new Response(JSON.stringify({ error: 'Kein Prompt angegeben' }), {
            status: 400, headers: corsHeaders
          });
        }

        if (prompt.length > 5000) {
          return new Response(JSON.stringify({ error: 'Prompt zu lang (max 5000 Zeichen)' }), {
            status: 400, headers: corsHeaders
          });
        }

        if (!sessionId || typeof sessionId !== 'string') {
          return new Response(JSON.stringify({ error: 'Keine gueltige Session-ID' }), {
            status: 400, headers: corsHeaders
          });
        }

        // === ZAHLUNG BEI STRIPE VERIFIZIEREN ===
        const stripeResponse = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
          {
            headers: {
              'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`
            }
          }
        );
        const session = await stripeResponse.json();

        if (session.error || session.payment_status !== 'paid') {
          return new Response(JSON.stringify({ error: 'Zahlung nicht bestaetigt' }), {
            status: 403, headers: corsHeaders
          });
        }

        // === LANGDOCK API AUFRUFEN ===
        const langdockResponse = await fetch('https://api.langdock.com/agent/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.LANGDOCK_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            agent_id: env.LANGDOCK_AGENT_ID,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        const result = await langdockResponse.json();
        const optimizedPrompt = result.choices?.[0]?.message?.content;

        if (!optimizedPrompt) throw new Error('Keine Antwort vom Agenten');

        return new Response(JSON.stringify({ optimizedPrompt }), {
          headers: corsHeaders
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: corsHeaders
        });
      }
    }

    // Unbekannte Route
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: corsHeaders
    });
  }
};
