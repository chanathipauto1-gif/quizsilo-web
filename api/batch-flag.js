// Serverless Function for Vercel (Auto-Generated)
// Manages batch flags (is_hidden, is_featured) and ratings (1-5 stars) in source_files._meta
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { batchId, flag, value, rating, userIdentifier, raterName, adminProfile } = body;

  if (!batchId) {
    return res.status(400).json({ error: 'Missing batchId' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtwlqtvyxtekuydlvpnb.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X2JIVUw1SXVnNlNKOXNZVk9kcGFPZndfMEZHdFd0Rjk=', 'base64').toString('utf8');

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Fetch current batch
    const bRes = await fetch(`${SUPABASE_URL}/rest/v1/batches?id=eq.${encodeURIComponent(batchId)}&select=*`, { headers });
    const bData = await bRes.json();
    if (!bData || bData.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    const batch = bData[0];

    // 2. Update source_files metadata
    const sourceFiles = Array.isArray(batch.source_files) ? [...batch.source_files] : [];
    const metaIdx = sourceFiles.findIndex(f => f && f._meta);
    const currentMeta = metaIdx >= 0 ? sourceFiles[metaIdx] : { _meta: true };

    // Branch A: Rating submission (flag === 'rate' or rating !== undefined)
    if (flag === 'rate' || rating !== undefined) {
      const starVal = parseInt(rating, 10);
      if (isNaN(starVal) || starVal < 1 || starVal > 5) {
        return res.status(400).json({ error: 'Invalid rating (1-5 required)' });
      }

      const rKey = String(userIdentifier || 'anonymous').trim();
      const ratings = Object.assign({}, currentMeta.ratings || {});
      ratings[rKey] = starVal;

      const ratingKeys = Object.keys(ratings);
      const ratingCount = ratingKeys.length;
      const ratingSum = ratingKeys.reduce((sum, k) => sum + (Number(ratings[k]) || 0), 0);
      const ratingAvg = ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(1)) : 0;

      const updatedMeta = {
        ...currentMeta,
        _meta: true,
        ratings,
        rating_count: ratingCount,
        rating_avg: ratingAvg
      };

      if (metaIdx >= 0) {
        sourceFiles[metaIdx] = updatedMeta;
      } else {
        sourceFiles.push(updatedMeta);
      }

      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/batches?id=eq.${encodeURIComponent(batchId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          source_files: sourceFiles,
          updated_at: new Date().toISOString()
        })
      });

      if (!updateRes.ok) {
        const uErr = await updateRes.text();
        throw new Error(uErr);
      }

      return res.status(200).json({
        success: true,
        batchId,
        rating_avg: ratingAvg,
        rating_count: ratingCount,
        user_rating: starVal
      });
    }

    // Branch B: Visibility or Pin Flag (is_hidden / is_featured)
    if (!flag) {
      return res.status(400).json({ error: 'Missing flag or rating' });
    }

    const updatedMeta = { ...currentMeta, [flag]: Boolean(value), _meta: true };

    if (metaIdx >= 0) {
      sourceFiles[metaIdx] = updatedMeta;
    } else {
      sourceFiles.push(updatedMeta);
    }

    // 3. Save back to Supabase batches
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/batches?id=eq.${encodeURIComponent(batchId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        source_files: sourceFiles,
        updated_at: new Date().toISOString()
      })
    });

    if (!updateRes.ok) {
      const uErr = await updateRes.text();
      throw new Error(uErr);
    }

    // 4. Log to scan_ledger
    try {
      const uName = adminProfile?.nickname || adminProfile?.name || 'ผู้ดูแลระบบ';
      const uAvatar = adminProfile?.avatar || '👤';
      const uRole = adminProfile?.role || 'admin';

      let actionName = 'UPDATE_BATCH';
      let actionDetails = '';
      if (flag === 'is_hidden') {
        actionName = value ? 'HIDE_BATCH' : 'SHOW_BATCH';
        actionDetails = value ? 'ซ่อนชุดข้อสอบจากคลังสาธารณะ' : 'เปิดแสดงชุดข้อสอบในคลังสาธารณะ';
      } else if (flag === 'is_featured') {
        actionName = value ? 'PIN_BATCH' : 'UNPIN_BATCH';
        actionDetails = value ? 'ปักหมุดเป็นชุดข้อสอบเด่น (แนะนำ)' : 'ยกเลิกการปักหมุดข้อสอบเด่น';
      }

      await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: adminProfile?.uuid || null,
          batch_id: batchId,
          questions_scanned: batch.total_questions || 0,
          status: 'LOG: ' + JSON.stringify({
            action: actionName,
            user_name: uName,
            user_avatar: uAvatar,
            user_role: uRole,
            batch_name: batch.batch_name,
            batch_category: batch.batch_category,
            question_count: batch.total_questions || 0,
            details: actionDetails,
            timestamp: new Date().toISOString()
          })
        })
      });
    } catch (le) {
      console.warn('Flag log warning:', le);
    }

    return res.status(200).json({
      success: true,
      batchId,
      flag,
      value: Boolean(value),
      is_hidden: Boolean(updatedMeta.is_hidden),
      is_featured: Boolean(updatedMeta.is_featured)
    });
  } catch (err) {
    console.error('batch-flag error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
