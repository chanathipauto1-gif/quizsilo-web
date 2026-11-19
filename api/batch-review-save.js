// Serverless Function for Vercel (Auto-Generated)
// Securely saves reviewed questions and updates batch verification status using Service Role Key (Bypasses RLS)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { batchId, updatedData, verifiedRows, extraMeta, userProfile } = body;

  if (!batchId) return res.status(400).json({ error: 'Missing batchId' });

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtwlqtvyxtekuydlvpnb.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X2JIVUw1SXVnNlNKOXNZVk9kcGFPZndfMEZHdFd0Rjk=', 'base64').toString('utf8');

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json'
  };

  try {
    const verifiedSet = new Set((verifiedRows || []).map(r => String(r)));
    const verifiedCount = verifiedSet.size;
    const totalQ = (updatedData || []).length;
    const isBatchAllVerified = (verifiedCount === totalQ && totalQ > 0);

    // 1. Update Batch
    const batchUpdatePayload = {
      is_verified: isBatchAllVerified,
      total_questions: totalQ,
      updated_at: new Date().toISOString()
    };
    if (extraMeta) {
      if (extraMeta.batchName) batchUpdatePayload.batch_name = extraMeta.batchName;
      if (extraMeta.batchCategory) batchUpdatePayload.batch_category = extraMeta.batchCategory;
    }

    const bRes = await fetch(`${SUPABASE_URL}/rest/v1/batches?id=eq.${encodeURIComponent(batchId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(batchUpdatePayload)
    });
    if (!bRes.ok) {
      console.warn('Batch update error:', await bRes.text());
    }

    // 2. Update Questions (in chunks of 25)
    const questionsList = Array.isArray(updatedData) ? updatedData : [];
    for (const q of questionsList) {
      const qNo = parseInt(q.row, 10);
      const isVer = verifiedSet.has(String(q.row));
      const updatePayload = {
        question_text: q.text || '',
        choice_a: q.a || '',
        choice_b: q.b || '',
        choice_c: q.c || '',
        choice_d: q.d || '',
        choice_e: q.e || '',
        choice_f: q.f || '',
        choice_g: q.g || '',
        choice_h: q.h || '',
        answer: q.answer || q.ans || 'ก',
        explanation: q.explanation || q.exp || '',
        is_free_question: !!q.isFreeQuestion || !!q.isFree || (q.answer === 'FREE'),
        source_type: isVer ? 'ยืนยันแล้ว' : (q.sourceType || 'รอตรวจ')
      };

      if (q.id) {
        await fetch(`${SUPABASE_URL}/rest/v1/questions?id=eq.${encodeURIComponent(q.id)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updatePayload)
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/questions?batch_id=eq.${encodeURIComponent(batchId)}&question_no=eq.${qNo}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updatePayload)
        });
      }
    }

    // 3. Log to scan_ledger if batch became fully verified
    if (isBatchAllVerified) {
      try {
        const uName = userProfile?.nickname || userProfile?.name || 'ผู้ตรวจทาน';
        const uAvatar = userProfile?.avatar || '👤';
        const uRole = userProfile?.role || 'member';
        const logPayload = {
          action: 'VERIFY_BATCH',
          user_name: uName,
          user_avatar: uAvatar,
          user_role: uRole,
          batch_id: batchId,
          batch_name: extraMeta?.batchName || 'ชุดข้อสอบ',
          batch_category: extraMeta?.batchCategory || 'ทั่วไป',
          question_count: totalQ,
          details: 'ตรวจสอบเฉลยครบทุกข้อและเผยแพร่สู่คลังข้อสอบ'
        };
        await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            user_id: userProfile?.uuid || null,
            batch_id: batchId,
            questions_scanned: totalQ,
            status: 'LOG: ' + JSON.stringify(logPayload)
          })
        });
      } catch (le) {
        console.warn('Verify log error:', le);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'บันทึกการตรวจสอบและแก้ไขเรียบร้อยแล้ว',
      updatedBatchName: extraMeta?.batchName,
      updatedBatchCategory: extraMeta?.batchCategory,
      verifiedSummary: `${verifiedCount}/${totalQ}`,
      isBatchAllVerified
    });
  } catch (err) {
    console.error('batch-review-save error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
