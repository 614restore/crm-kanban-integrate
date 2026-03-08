export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'AI not configured',
      message: 'Add OPENAI_API_KEY to your Vercel environment variables to enable AI drafting.',
    });
  }

  const { contactName, projectType, context, tone } = req.body || {};

  if (!contactName) {
    return res.status(400).json({ error: 'contactName is required' });
  }

  const systemPrompt = `You are a professional assistant for a roofing/restoration contractor. 
Write concise, professional customer emails. Keep them warm but businesslike.
Always respond with valid JSON only: { "subject": "...", "body": "..." }`;

  const userPrompt = `Write a professional email to ${contactName}.
Project type: ${projectType || 'roofing/restoration'}
Tone: ${tone || 'professional and helpful'}
${context ? `Context: ${context}` : ''}
Reply ONLY with JSON: { "subject": "...", "body": "..." }`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(502).json({
        error: 'OpenAI error',
        message: err.error?.message || 'Unknown error from OpenAI',
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';

    // Strip ```json fences if present
    const json = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      // Fallback: return raw as body
      return res.json({ subject: 'Your Estimate', body: raw });
    }

    return res.json({ subject: parsed.subject || '', body: parsed.body || '' });
  } catch (err) {
    console.error('ai-draft error:', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}
