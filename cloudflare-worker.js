export default {
  async fetch(request, env) {
    // CORS
    if (request.method === 'OPTIONS') {
      return new Response('', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST'
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    try {
      const { prompt } = await request.json();

      if (!prompt) {
        return new Response(JSON.stringify({ error: 'Kein Prompt angegeben' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Langdock Agent API aufrufen
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

      if (!optimizedPrompt) {
        throw new Error('Keine Antwort vom Agenten');
      }

      return new Response(JSON.stringify({ optimizedPrompt }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
