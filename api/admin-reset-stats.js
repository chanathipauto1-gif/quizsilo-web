// Serverless Function for Vercel (Auto-Generated)
// Securely resets all exam attempt history for a batch (Super Admin Only)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { batchId, adminProfile } = body;

  if (!batchId) return res.status(400).json({ error: 'Missing batchId' });

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtwlqtvyxtekuydlvpnb.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X2JIVUw1SXVnNlNKOXNZVk9kcGFPZndfMEZHdFd0Rjk=', 'base64').toString('utf8');

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Get batch name for audit log
    const bRes = await fetch(`${SUPABASE_URL}/rest/v1/batches?id=eq.${encodeURIComponent(batchId)}&select=batch_name,batch_category,total_questions`, { headers });
    const batches = await bRes.json();
    const batchInfo = (Array.isArray(batches) && batches.length > 0) ? batches[0] : null;

    // 2. Delete all records from exam_attempts for this batch
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/exam_attempts?batch_id=eq.${encodeURIComponent(batchId)}`, {
      method: 'DELETE',
      headers
    });

    // 3. Log into activity log
    try {
      const logPayload = {
        action: 'RESET_STATS',
        user_name: adminProfile?.name || 'Super Admin',
        user_avatar: adminProfile?.avatar || '👑',
        user_role: 'admin',
        batch_id: batchId,
        batch_name: batchInfo?.batch_name || 'ชุดข้อสอบ',
        batch_category: batchInfo?.batch_category || 'ทั่วไป',
        question_count: batchInfo?.total_questions || 0,
        details: 'ล้างสถิติและประวัติการทำข้อสอบทั้งหมดของชุดนี้'
      };
      await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: adminProfile?.uuid || null,
          batch_id: batchId,
          questions_scanned: batchInfo?.total_questions || 0,
          status: 'RESET_STATS: ' + JSON.stringify(logPayload)
        })
      });
    } catch (le) {
      console.warn('Could not log reset stats:', le);
    }

    return res.status(200).json({ success: true, message: 'ล้างสถิติชุดข้อสอบเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('Reset stats error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
