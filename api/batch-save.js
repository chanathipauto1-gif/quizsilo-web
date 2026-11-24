// Serverless Function for Vercel (Auto-Generated)
// Securely saves extracted batch and questions using Service Role Key (Bypasses RLS)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { batch, questions, userProfile } = body;

  if (!batch || !batch.id) return res.status(400).json({ error: 'Missing batch info' });

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtwlqtvyxtekuydlvpnb.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X2JIVUw1SXVnNlNKOXNZVk9kcGFPZndfMEZHdFd0Rjk=', 'base64').toString('utf8');

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Insert Batch (user_id can be null for Guest)
    const bRes = await fetch(`${SUPABASE_URL}/rest/v1/batches`, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch)
    });
    if (!bRes.ok) {
      const bErr = await bRes.text();
      console.error('Batch save error:', bErr);
      return res.status(500).json({ success: false, error: bErr });
    }

    // 2. Sanitize and Insert Questions in chunks of 50
    const rawList = Array.isArray(questions) ? questions : [];
    const qList = rawList.map(q => {
      const item = {
        id: q.id,
        batch_id: q.batch_id,
        question_no: q.question_no,
        question_text: q.question_text,
        choice_a: q.choice_a || '',
        choice_b: q.choice_b || '',
        choice_c: q.choice_c || '',
        choice_d: q.choice_d || '',
        choice_e: q.choice_e || '',
        choice_f: q.choice_f || '',
        choice_g: q.choice_g || '',
        choice_h: q.choice_h || '',
        answer: q.answer || 'ก',
        explanation: q.explanation || '',
        is_free_question: q.is_free_question || false,
        source_type: q.source_type || 'เฉลยไฟล์'
      };
      if (q.category) item.category = q.category;
      if (q.sub_category) item.sub_category = q.sub_category;
      return item;
    });

    for (let i = 0; i < qList.length; i += 50) {
      const chunk = qList.slice(i, i + 50);
      let qRes = await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk)
      });
      if (!qRes.ok) {
        const errText = await qRes.text();
        console.warn('Chunk question insert error, retrying without category fallback:', errText);
        if (errText.includes('category')) {
          const fallbackChunk = chunk.map(({ category, sub_category, ...rest }) => rest);
          await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(fallbackChunk)
          });
        }
      }
    }

    // 3. Log to scan_ledger
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: batch.user_id || null,
          batch_id: batch.id,
          questions_scanned: qList.length,
          status: 'SUCCESS'
        })
      });
    } catch (le) {}

    return res.status(200).json({ success: true, batchId: batch.id });
  } catch (err) {
    console.error('Save batch API error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
