// Serverless Function for Vercel (Auto-Generated)
// Deletes a batch and its questions, attempts, and records to audit log
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { batchId, userProfile } = body;

  if (!batchId) return res.status(400).json({ error: 'Missing batchId' });

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtwlqtvyxtekuydlvpnb.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X2JIVUw1SXVnNlNKOXNZVk9kcGFPZndfMEZHdFd0Rjk=', 'base64').toString('utf8');

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Fetch batch info for audit logging
    const bRes = await fetch(`${SUPABASE_URL}/rest/v1/batches?id=eq.${encodeURIComponent(batchId)}&select=batch_name,batch_category,total_questions,user_id`, { headers });
    const batches = await bRes.json();
    const batchInfo = (Array.isArray(batches) && batches.length > 0) ? batches[0] : null;

    // 2. Delete questions
    await fetch(`${SUPABASE_URL}/rest/v1/questions?batch_id=eq.${encodeURIComponent(batchId)}`, { method: 'DELETE', headers });

    // 3. Delete attempts
    await fetch(`${SUPABASE_URL}/rest/v1/exam_attempts?batch_id=eq.${encodeURIComponent(batchId)}`, { method: 'DELETE', headers });

    // 4. Delete batch
    await fetch(`${SUPABASE_URL}/rest/v1/batches?id=eq.${encodeURIComponent(batchId)}`, { method: 'DELETE', headers });

    // 4.1 Delete any question flags and resolutions in scan_ledger associated with this deleted batch
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger?or=(status.like.FLAG_QUESTION*%22${encodeURIComponent(batchId)}%22*,status.like.RESOLVE_FLAG*%22${encodeURIComponent(batchId)}%22*)`, { method: 'DELETE', headers });
    } catch (fe) {}

    // 5. Record deletion in scan_ledger as Audit Log
    try {
      const uName = userProfile?.nickname || userProfile?.name || 'ผู้ใช้';
      const uAvatar = userProfile?.avatar || '👤';
      const uRole = userProfile?.role || 'member';
      const logPayload = {
        action: 'DELETE_BATCH',
        user_name: uName,
        user_avatar: uAvatar,
        user_role: uRole,
        batch_id: batchId,
        batch_name: batchInfo?.batch_name || 'ชุดข้อสอบ',
        batch_category: batchInfo?.batch_category || 'ทั่วไป',
        question_count: batchInfo?.total_questions || 0,
        details: 'ลบชุดข้อสอบและคำถามทั้งหมดออกจากระบบถาวร'
      };
      await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userProfile?.uuid || null,
          batch_id: null,
          questions_scanned: batchInfo?.total_questions || 0,
          status: 'LOG: ' + JSON.stringify(logPayload)
        })
      });
    } catch (le) {
      console.warn('Could not record delete audit log:', le);
    }

    return res.status(200).json({ success: true, message: 'ลบชุดข้อสอบเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('Batch delete error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
