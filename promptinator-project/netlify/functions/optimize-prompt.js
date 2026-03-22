const Stripe = require('stripe');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { prompt } = JSON.parse(event.body);

        // Langdock Agent API aufrufen
        const response = await fetch('https://api.langdock.com/agent/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.LANGDOCK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                agent_id: process.env.LANGDOCK_AGENT_ID,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        const result = await response.json();
        const optimizedPrompt = result.choices?.[0]?.message?.content;

        if (!optimizedPrompt) {
            throw new Error('Keine Antwort vom Agenten');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ optimizedPrompt })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
