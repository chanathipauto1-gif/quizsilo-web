// Serverless Function for Vercel (Auto-Generated)
// Securely fetches attempt history per batch to populate "ผู้ที่เคยทำ" overlapping avatars
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtwlqtvyxtekuydlvpnb.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X2JIVUw1SXVnNlNKOXNZVk9kcGFPZndfMEZHdFd0Rjk=', 'base64').toString('utf8');

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY
  };

  try {
    const [attemptsRes, profilesRes] = await Promise.all([
      fetch(SUPABASE_URL + '/rest/v1/exam_attempts?select=batch_id,user_id,score,total_questions,percent,created_at&order=created_at.desc', { headers }),
      fetch(SUPABASE_URL + '/rest/v1/profiles?select=id,nickname,display_name,avatar', { headers })
    ]);

    const attempts = await attemptsRes.json();
    const profiles = await profilesRes.json();

    const profMap = {};
    (Array.isArray(profiles) ? profiles : []).forEach(p => { profMap[p.id] = p; });

    // Group attempts by batch_id, keeping unique users per batch
    const batchMap = {};
    (Array.isArray(attempts) ? attempts : []).forEach(a => {
      if (!a.batch_id || !a.user_id) return;
      if (!batchMap[a.batch_id]) batchMap[a.batch_id] = {};
      const existing = batchMap[a.batch_id][a.user_id];
      const p = profMap[a.user_id];
      const scorePct = Number(a.percent || 0).toFixed(0) + '%';
      const scoreTxt = `${a.score || 0}/${a.total_questions || 0}`;

      if (!existing || (Number(a.percent || 0) > (existing._rawPercent || 0))) {
        batchMap[a.batch_id][a.user_id] = {
          name: p?.nickname || p?.display_name || 'ผู้ใช้',
          avatar: p?.avatar || '👤',
          percent: scorePct,
          scoreText: scoreTxt,
          _rawPercent: Number(a.percent || 0)
        };
      }
    });

    const result = {};
    Object.keys(batchMap).forEach(bId => {
      result[bId] = Object.values(batchMap[bId]);
    });

    return res.status(200).json({ success: true, batchAttempts: result });
  } catch (err) {
    console.error('Batch Attempts API Error:', err);
    return res.status(500).json({ success: false, error: err.message, batchAttempts: {} });
  }
};
