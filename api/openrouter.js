// Serverless Function for Vercel (Auto-Generated)
// Securely proxies AI calls to OpenRouter without exposing API keys to the browser
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Title');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ยังไม่ได้ตั้งค่า OPENROUTER_API_KEY ใน Vercel Environment Variables (กรุณาไปที่ Project Settings > Environment Variables บน Vercel)'
    });
  }

  try {
    const upstreamRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers['referer'] || 'https://quizsilo.vercel.app',
        'X-Title': req.headers['x-title'] || 'QuizSilo'
      },
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    });

    const data = await upstreamRes.json();
    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    console.error('OpenRouter Proxy Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Proxy Error' });
  }
};
