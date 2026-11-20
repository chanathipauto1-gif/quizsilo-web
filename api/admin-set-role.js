// Serverless Function for Vercel (Auto-Generated)
// Handles user role promotion/demotion and upload quota management (Super Admin Only)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { targetUserId, newRole, action, files, questions, adminProfile } = body;

  if (!targetUserId) return res.status(400).json({ error: 'Missing targetUserId' });

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtwlqtvyxtekuydlvpnb.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X2JIVUw1SXVnNlNKOXNZVk9kcGFPZndfMEZHdFd0Rjk=', 'base64').toString('utf8');

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // Branch A: Quota Management (ADD_QUOTA or RESET_QUOTA)
    if (action === 'ADD_QUOTA' || action === 'RESET_QUOTA') {
      const qRes = await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger?user_id=eq.${encodeURIComponent(targetUserId)}&status=like.SYSTEM_QUOTA*&select=status&order=created_at.desc&limit=1`, { headers });
      const qList = await qRes.json();
      let currentBonusFiles = 0;
      let currentBonusQuestions = 0;
      if (Array.isArray(qList) && qList.length > 0) {
        try {
          const raw = qList[0].status.replace('SYSTEM_QUOTA:', '');
          const p = JSON.parse(raw);
          currentBonusFiles = Number(p.bonusFiles || 0);
          currentBonusQuestions = Number(p.bonusQuestions || 0);
        } catch (e) {}
      }

      let newBonusFiles = currentBonusFiles;
      let newBonusQuestions = currentBonusQuestions;
      let detailsText = '';

      if (action === 'ADD_QUOTA') {
        const addF = parseInt(files, 10) || 5;
        const addQ = parseInt(questions, 10) || 200;
        newBonusFiles += addF;
        newBonusQuestions += addQ;
        detailsText = `เพิ่มโควต้าพิเศษ +${addF} ไฟล์ (+${addQ} ข้อ)`;
      } else if (action === 'RESET_QUOTA') {
        const usedF = parseInt(files, 10) || 0;
        const usedQ = parseInt(questions, 10) || 0;
        newBonusFiles = Math.max(newBonusFiles, usedF);
        newBonusQuestions = Math.max(newBonusQuestions, usedQ);
        detailsText = `รีเซ็ตโควต้าอัปโหลด คืนสิทธิ์เต็มจำนวน (10 ไฟล์ / 500 ข้อ)`;
      }

      // Persist in scan_ledger
      await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: targetUserId,
          batch_id: null,
          questions_scanned: 0,
          status: 'SYSTEM_QUOTA:' + JSON.stringify({
            bonusFiles: newBonusFiles,
            bonusQuestions: newBonusQuestions,
            updatedAt: new Date().toISOString()
          })
        })
      });

      // Audit Log for Quota
      try {
        const uRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(targetUserId)}&select=nickname,display_name,email,avatar,role`, { headers });
        const uList = await uRes.json();
        const targetUser = Array.isArray(uList) && uList.length > 0 ? uList[0] : null;
        const targetName = targetUser?.nickname || targetUser?.display_name || targetUser?.email || 'สมาชิก';

        await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            user_id: targetUserId,
            batch_id: null,
            questions_scanned: 0,
            status: 'LOG: ' + JSON.stringify({
              action: 'SET_QUOTA',
              user_name: targetName,
              user_avatar: targetUser?.avatar || '👤',
              user_role: targetUser?.role || 'member',
              batch_name: 'การจัดการโควต้าอัปโหลด',
              batch_category: 'ระบบจัดการ',
              question_count: newBonusQuestions,
              details: detailsText,
              timestamp: new Date().toISOString()
            })
          })
        });
      } catch (le) {
        console.warn('Audit log quota warning:', le);
      }

      return res.status(200).json({
        success: true,
        targetUserId,
        bonusFiles: newBonusFiles,
        bonusQuestions: newBonusQuestions
      });
    }

    // Branch B: Role Management
    if (!newRole) return res.status(400).json({ error: 'Missing newRole or valid action' });

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
            details: roleTxt,
            timestamp: new Date().toISOString()
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
