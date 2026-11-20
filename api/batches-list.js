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
    const [bRes, pRes, rolesRes, quotasRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/batches?select=*&order=created_at.desc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,nickname,display_name,avatar,role`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/scan_ledger?status=like.SYSTEM_ROLE*&select=user_id,status,created_at&order=created_at.asc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/scan_ledger?status=like.SYSTEM_QUOTA*&select=user_id,status,created_at&order=created_at.asc`, { headers })
    ]);

    const batches = await bRes.json();
    const profiles = await pRes.json();
    const roles = await rolesRes.json();
    const quotas = await quotasRes.json();

    const roleMap = {};
    (Array.isArray(roles) ? roles : []).forEach(r => {
      if (r.user_id && r.status) {
        roleMap[r.user_id] = r.status.replace('SYSTEM_ROLE:', '');
      }
    });

    const quotaMap = {};
    (Array.isArray(quotas) ? quotas : []).forEach(q => {
      if (q.user_id && q.status) {
        try {
          const raw = q.status.replace('SYSTEM_QUOTA:', '');
          const parsed = JSON.parse(raw);
          quotaMap[q.user_id] = {
            bonusFiles: Number(parsed.bonusFiles || 0),
            bonusQuestions: Number(parsed.bonusQuestions || 0),
            resetAt: parsed.resetAt || null
          };
        } catch (e) {}
      }
    });

    const profileMap = {};
    (Array.isArray(profiles) ? profiles : []).forEach(p => {
      profileMap[p.id] = {
        ...p,
        role: roleMap[p.id] || p.role || 'student'
      };
    });

    return res.status(200).json({
      success: true,
      batches: Array.isArray(batches) ? batches : [],
      profileMap,
      quotaMap,
      roleMap
    });
  } catch (err) {
    console.error('batches-list error:', err);
    return res.status(500).json({ success: false, error: err.message, batches: [] });
  }
};
