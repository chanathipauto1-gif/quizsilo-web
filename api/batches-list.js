// Serverless Function for Vercel (Auto-Generated)
// Fetches all batches and profiles using Service Role Key (bypassing RLS so unverified guest batches are accessible)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtwlqtvyxtekuydlvpnb.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X2JIVUw1SXVnNlNKOXNZVk9kcGFPZndfMEZHdFd0Rjk=', 'base64').toString('utf8');

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY
  };

  try {
    const [bRes, pRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/batches?select=*&order=created_at.desc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,nickname,display_name,avatar`, { headers })
    ]);

    const batches = await bRes.json();
    const profiles = await pRes.json();

    const profileMap = {};
    (Array.isArray(profiles) ? profiles : []).forEach(p => {
      profileMap[p.id] = p;
    });

    return res.status(200).json({ success: true, batches: Array.isArray(batches) ? batches : [], profileMap });
  } catch (err) {
    console.error('batches-list error:', err);
    return res.status(500).json({ success: false, error: err.message, batches: [] });
  }
};
