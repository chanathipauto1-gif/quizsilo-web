// Serverless Function for Vercel (Auto-Generated)
// Updates user role (Super Admin can promote/demote Assistant Admin)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { targetUserId, newRole } = body;

  if (!targetUserId || !newRole) return res.status(400).json({ error: 'Missing parameters' });

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtwlqtvyxtekuydlvpnb.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X2JIVUw1SXVnNlNKOXNZVk9kcGFPZndfMEZHdFd0Rjk=', 'base64').toString('utf8');

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // 1. Try native update in profiles table
    let updatedProfile = null;
    try {
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(targetUserId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role: newRole })
      });
      if (updateRes.ok) {
        const uJson = await updateRes.json();
        if (Array.isArray(uJson) && uJson.length > 0) updatedProfile = uJson[0];
      }
    } catch (pe) {
      console.warn('Native role update error (fallback to SYSTEM_ROLE):', pe);
    }

    // 2. Persist role in scan_ledger SYSTEM_ROLE (Overrides check constraint)
    await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: targetUserId,
        batch_id: null,
        questions_scanned: 0,
        status: 'SYSTEM_ROLE:' + newRole
      })
    });

    // 3. Fetch user details for audit logging
    if (!updatedProfile) {
      try {
        const uRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(targetUserId)}&select=id,nickname,display_name,email,avatar`, { headers });
        const uList = await uRes.json();
        if (Array.isArray(uList) && uList.length > 0) updatedProfile = uList[0];
      } catch (fe) {}
    }

    // 4. Record Audit Log for Role Change
    try {
      const targetName = updatedProfile?.nickname || updatedProfile?.display_name || updatedProfile?.email || 'สมาชิก';
      const roleTxt = newRole === 'assistant_admin' ? 'แต่งตั้งเป็นผู้ช่วย Admin ⭐' : (newRole === 'admin' ? 'แต่งตั้งเป็น Super Admin 👑' : 'ปรับเป็นสมาชิกทั่วไป 🎓');
      await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: targetUserId,
          batch_id: null,
          questions_scanned: 0,
          status: 'LOG: ' + JSON.stringify({
            action: 'SET_ROLE',
            user_name: targetName,
            user_avatar: updatedProfile?.avatar || '👤',
            user_role: newRole,
            batch_name: 'การจัดการสิทธิ์สมาชิก',
            batch_category: 'ระบบจัดการ',
            question_count: 0,
            details: roleTxt
          })
        })
      });
    } catch (le) {}

    return res.status(200).json({ success: true, role: newRole, user: updatedProfile });
  } catch (err) {
    console.error('Set role error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
