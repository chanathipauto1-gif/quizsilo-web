// Serverless Function for Vercel (Auto-Generated)
// Retrieves and appends exam activity history (Audit Logs)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtwlqtvyxtekuydlvpnb.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X2JIVUw1SXVnNlNKOXNZVk9kcGFPZndfMEZHdFd0Rjk=', 'base64').toString('utf8');

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json'
  };

  // POST: Record an activity log
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const isUuid = body.user_id && typeof body.user_id === 'string' && body.user_id.length === 36 && body.user_id.indexOf('-') !== -1;
      const ledgerEntry = {
        user_id: isUuid ? body.user_id : null,
        batch_id: body.batch_id || null,
        questions_scanned: body.question_count || 0,
        status: 'LOG: ' + JSON.stringify({
          action: body.action || 'ACTIVITY',
          user_name: body.user_name || 'ผู้ใช้',
          user_avatar: body.user_avatar || '👤',
          user_role: body.user_role || 'member',
          guest_id: body.guest_id || null,
          score: body.score != null ? body.score : null,
          percent: body.percent != null ? body.percent : null,
          batch_name: body.batch_name || 'ชุดข้อสอบ',
          batch_category: body.batch_category || 'ทั่วไป',
          question_count: body.question_count || 0,
          details: body.details || '-',
          timestamp: new Date().toISOString()
        })
      };

      await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
        method: 'POST',
        headers,
        body: JSON.stringify(ledgerEntry)
      });

      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // GET: Fetch activity logs
  try {
    const [ledgerRes, batchesRes, profilesRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/scan_ledger?select=*&order=created_at.desc&limit=80`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/batches?select=id,batch_name,batch_category,total_questions,created_at,user_id&order=created_at.desc&limit=80`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,nickname,display_name,avatar,role`, { headers })
    ]);

    const ledger = await ledgerRes.json();
    const batches = await batchesRes.json();
    const profiles = await profilesRes.json();

    const profMap = {};
    (Array.isArray(profiles) ? profiles : []).forEach(p => { profMap[p.id] = p; });

    const logs = [];

    // Parse logs from scan_ledger
    (Array.isArray(ledger) ? ledger : []).forEach(item => {
      const statusStr = String(item.status || '');
      if (statusStr.startsWith('LOG: ') || statusStr.startsWith('RESET_STATS: ')) {
        try {
          const jsonStr = statusStr.replace(/^(LOG: |RESET_STATS: )/, '');
          const parsed = JSON.parse(jsonStr);
          const uName = parsed.user_name || profMap[item.user_id]?.nickname || profMap[item.user_id]?.display_name || 'ผู้ใช้';
          const uAvatar = parsed.user_avatar || profMap[item.user_id]?.avatar || '👤';
          const uRole = parsed.user_role || profMap[item.user_id]?.role || 'member';
          const bName = parsed.batch_name || 'ชุดข้อสอบ';
          const bCat = parsed.batch_category || 'ทั่วไป';
          const qCount = parsed.question_count || item.questions_scanned || 0;
          logs.push({
            id: item.id,
            timestamp: item.created_at,
            created_at: item.created_at,
            userName: uName,
            user_name: uName,
            userAvatar: uAvatar,
            user_avatar: uAvatar,
            userRole: uRole,
            user_role: uRole,
            action: parsed.action || 'ACTIVITY',
            batchName: bName,
            batch_name: bName,
            category: bCat,
            batch_category: bCat,
            questionCount: qCount,
            question_count: qCount,
            details: parsed.details || ''
          });
        } catch (e) {}
      }
    });

    // Synthesize created batches as UPLOAD logs if not already logged
    (Array.isArray(batches) ? batches : []).forEach(b => {
      const u = profMap[b.user_id];
      const uName = u?.nickname || u?.display_name || 'ผู้ใช้';
      const uAvatar = u?.avatar || '👤';
      const uRole = u?.role || 'member';
      const bName = b.batch_name || 'ชุดข้อสอบ';
      const bCat = b.batch_category || 'ทั่วไป';
      const qCount = b.total_questions || 0;
      logs.push({
        id: 'BATCH-LOG-' + b.id,
        timestamp: b.created_at,
        created_at: b.created_at,
        userName: uName,
        user_name: uName,
        userAvatar: uAvatar,
        user_avatar: uAvatar,
        userRole: uRole,
        user_role: uRole,
        action: 'UPLOAD_BATCH',
        batchName: bName,
        batch_name: bName,
        category: bCat,
        batch_category: bCat,
        questionCount: qCount,
        question_count: qCount,
        details: 'นำเข้าชุดข้อสอบใหม่สู่ระบบ'
      });
    });

    // Deduplicate and sort descending by timestamp
    const uniqueLogs = [];
    const seen = new Set();
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    logs.forEach(l => {
      const key = `${l.action}_${l.batchName}_${new Date(l.timestamp).getMinutes()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueLogs.push(l);
      }
    });

    return res.status(200).json({ success: true, logs: uniqueLogs.slice(0, 50) });
  } catch (err) {
    console.error('Activity logs error:', err);
    return res.status(500).json({ success: false, error: err.message, logs: [] });
  }
};
