// Serverless Function for Vercel (Auto-Generated)
// Manages batch flags (is_hidden, is_featured), ratings, and question issue reports
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { batchId, flag, value, rating, userIdentifier, raterName, questionIndex, questionId, questionText, issueType, userNote, reporterProfile, flagLedgerId, resolutionNote, adminProfile } = body;

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtwlqtvyxtekuydlvpnb.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X2JIVUw1SXVnNlNKOXNZVk9kcGFPZndfMEZHdFd0Rjk=', 'base64').toString('utf8');

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json'
  };

  try {
    // -------------------------------------------------------------
    // Branch 1: Get all flagged questions & auto-hidden batches (for Admin)
    // -------------------------------------------------------------
    if (flag === 'get_flags') {
      const [ledgerRes, batchesRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/scan_ledger?or=(status.like.FLAG_QUESTION*,status.like.RESOLVE_FLAG*)&select=*&order=created_at.desc&limit=150`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/batches?select=id,batch_name,batch_category,source_files,total_questions&order=created_at.desc&limit=100`, { headers })
      ]);

      const ledgerRows = await ledgerRes.json();
      const batchesList = await batchesRes.json();

      const batchMap = {};
      const autoHiddenBatches = [];
      (Array.isArray(batchesList) ? batchesList : []).forEach(b => {
        batchMap[b.id] = b;
        const sourceFiles = Array.isArray(b.source_files) ? b.source_files : [];
        const meta = sourceFiles.find(f => f && f._meta) || {};
        if (Number(meta.flag_count) >= 10 || meta.auto_hidden) {
          autoHiddenBatches.push({
            batchId: b.id,
            batchName: b.batch_name,
            category: b.batch_category,
            totalQuestions: b.total_questions,
            flagCount: Number(meta.flag_count) || 0,
            isHidden: Boolean(meta.is_hidden)
          });
        }
      });

      // Track resolved flag IDs
      const resolvedMap = {};
      (Array.isArray(ledgerRows) ? ledgerRows : []).forEach(row => {
        if (row.status && row.status.startsWith('RESOLVE_FLAG:')) {
          try {
            const raw = row.status.replace('RESOLVE_FLAG:', '');
            const p = JSON.parse(raw);
            if (p.flag_ledger_id) resolvedMap[p.flag_ledger_id] = p;
          } catch (e) {}
        }
      });

      const flags = [];
      (Array.isArray(ledgerRows) ? ledgerRows : []).forEach(row => {
        if (row.status && row.status.startsWith('FLAG_QUESTION:')) {
          try {
            const raw = row.status.replace('FLAG_QUESTION:', '');
            const p = JSON.parse(raw);
            const b = batchMap[p.batch_id] || { batch_name: p.batch_name || 'ชุดข้อสอบ', batch_category: 'ทั่วไป' };
            const isResolved = Boolean(resolvedMap[row.id]);
            flags.push({
              ledgerId: row.id,
              batchId: p.batch_id,
              batchName: b.batch_name || p.batch_name || 'ชุดข้อสอบ',
              questionIndex: p.question_index,
              questionId: p.question_id,
              questionText: p.question_text || '',
              issueType: p.issue_type || 'ANSWER_WRONG',
              userNote: p.user_note || '',
              reporterName: p.reporter_name || 'ผู้เรียน',
              reporterAvatar: p.reporter_avatar || '👤',
              createdAt: p.created_at || row.created_at,
              status: isResolved ? 'RESOLVED' : 'PENDING',
              resolution: resolvedMap[row.id] || null
            });
          } catch (e) {}
        }
      });

      return res.status(200).json({
        success: true,
        flags,
        autoHiddenBatches
      });
    }

    // -------------------------------------------------------------
    // Branch 1.5: Get flagged questions for a specific batch (Review & Edit mode)
    // -------------------------------------------------------------
    if (flag === 'get_batch_flags') {
      if (!batchId) return res.status(400).json({ error: 'Missing batchId' });
      const ledgerRes = await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger?batch_id=eq.${encodeURIComponent(batchId)}&or=(status.like.FLAG_QUESTION*,status.like.RESOLVE_FLAG*)&select=*&order=created_at.desc&limit=60`, { headers });
      const ledgerRows = await ledgerRes.json();

      const resolvedMap = {};
      (Array.isArray(ledgerRows) ? ledgerRows : []).forEach(row => {
        if (row.status && row.status.startsWith('RESOLVE_FLAG:')) {
          try {
            const raw = row.status.replace('RESOLVE_FLAG:', '');
            const p = JSON.parse(raw);
            if (p.flag_ledger_id) resolvedMap[p.flag_ledger_id] = p;
          } catch (e) {}
        }
      });

      const flags = [];
      (Array.isArray(ledgerRows) ? ledgerRows : []).forEach(row => {
        if (row.status && row.status.startsWith('FLAG_QUESTION:')) {
          try {
            const raw = row.status.replace('FLAG_QUESTION:', '');
            const p = JSON.parse(raw);
            const isResolved = Boolean(resolvedMap[row.id]);
            flags.push({
              ledgerId: row.id,
              batchId: p.batch_id,
              questionIndex: p.question_index,
              questionId: p.question_id,
              questionText: p.question_text || '',
              issueType: p.issue_type || 'ANSWER_WRONG',
              userNote: p.user_note || '',
              reporterName: p.reporter_name || 'ผู้เรียน',
              createdAt: p.created_at || row.created_at,
              status: isResolved ? 'RESOLVED' : 'PENDING'
            });
          } catch (e) {}
        }
      });

      return res.status(200).json({
        success: true,
        batchId,
        flags,
        pendingFlags: flags.filter(f => f.status === 'PENDING')
      });
    }

    // -------------------------------------------------------------
    // Branch 1.6: Get Global Announcement
    // -------------------------------------------------------------
    if (flag === 'get_announcement') {
      const annRes = await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger?status=like.SYSTEM_ANNOUNCEMENT*&select=*&order=created_at.desc&limit=1`, { headers });
      const annRows = await annRes.json();
      let announcement = null;
      if (Array.isArray(annRows) && annRows.length > 0) {
        try {
          const raw = annRows[0].status.replace('SYSTEM_ANNOUNCEMENT:', '');
          announcement = JSON.parse(raw);
          announcement.id = annRows[0].id;
          announcement.createdAt = annRows[0].created_at;
        } catch (e) {}
      }
      return res.status(200).json({ success: true, announcement });
    }

    // -------------------------------------------------------------
    // Branch 1.7: Set / Update Global Announcement (Admin only)
    // -------------------------------------------------------------
    if (flag === 'set_announcement') {
      const { announcementData, adminProfile } = body;
      if (!announcementData) return res.status(400).json({ error: 'Missing announcementData' });

      await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: adminProfile?.uuid || null,
          batch_id: null,
          questions_scanned: 0,
          status: 'SYSTEM_ANNOUNCEMENT:' + JSON.stringify({
            enabled: Boolean(announcementData.enabled),
            title: String(announcementData.title || '').trim(),
            description: String(announcementData.description || '').trim(),
            icon: announcementData.icon || '📢',
            imageUrl: String(announcementData.imageUrl || '').trim(),
            buttonText: String(announcementData.buttonText || '').trim(),
            buttonUrl: String(announcementData.buttonUrl || '').trim(),
            updatedBy: adminProfile?.name || adminProfile?.nickname || 'Super Admin',
            updatedAt: new Date().toISOString()
          })
        })
      });

      // Audit Log
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            user_id: adminProfile?.uuid || null,
            batch_id: null,
            questions_scanned: 0,
            status: 'LOG: ' + JSON.stringify({
              action: 'SET_ANNOUNCEMENT',
              user_name: adminProfile?.name || 'Admin',
              user_avatar: adminProfile?.avatar || '👑',
              user_role: 'admin',
              batch_name: 'ระบบส่วนกลาง',
              batch_category: 'ประกาศ',
              question_count: 0,
              details: announcementData.enabled
                ? `เปิดแถบประกาศหน้าแรก: "${(announcementData.title || '').slice(0, 40)}..."`
                : 'ปิดการแสดงผลแถบประกาศหน้าแรก',
              timestamp: new Date().toISOString()
            })
          })
        });
      } catch (e) {}

      return res.status(200).json({ success: true, message: 'บันทึกประกาศหน้าแรกเรียบร้อยแล้ว' });
    }

    // -------------------------------------------------------------
    // Branch 1.8: Get Footer / Site Config
    // -------------------------------------------------------------
    if (flag === 'get_footer_config') {
      const footerRes = await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger?status=like.SYSTEM_FOOTER_CONFIG*&select=*&order=created_at.desc&limit=1`, { headers });
      const footerRows = await footerRes.json();
      let footerConfig = null;
      if (Array.isArray(footerRows) && footerRows.length > 0) {
        try {
          const raw = footerRows[0].status.replace('SYSTEM_FOOTER_CONFIG:', '');
          footerConfig = JSON.parse(raw);
          footerConfig.id = footerRows[0].id;
          footerConfig.createdAt = footerRows[0].created_at;
        } catch (e) {}
      }
      return res.status(200).json({ success: true, footerConfig });
    }

    // -------------------------------------------------------------
    // Branch 1.9: Set / Update Footer / Site Config (Admin only)
    // -------------------------------------------------------------
    if (flag === 'set_footer_config') {
      const { footerData, adminProfile } = body;
      if (!footerData) return res.status(400).json({ error: 'Missing footerData' });

      await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: adminProfile?.uuid || null,
          batch_id: null,
          questions_scanned: 0,
          status: 'SYSTEM_FOOTER_CONFIG:' + JSON.stringify({
            brandTagline: String(footerData.brandTagline || '').trim(),
            brandBio: String(footerData.brandBio || '').trim(),
            copyrightText: String(footerData.copyrightText || '').trim(),
            facebookUrl: String(footerData.facebookUrl || '').trim(),
            facebookEnabled: Boolean(footerData.facebookEnabled),
            lineUrl: String(footerData.lineUrl || '').trim(),
            lineEnabled: Boolean(footerData.lineEnabled),
            tiktokUrl: String(footerData.tiktokUrl || '').trim(),
            tiktokEnabled: Boolean(footerData.tiktokEnabled),
            email: String(footerData.email || '').trim(),
            emailEnabled: Boolean(footerData.emailEnabled),
            youtubeUrl: String(footerData.youtubeUrl || '').trim(),
            youtubeEnabled: Boolean(footerData.youtubeEnabled),
            discordUrl: String(footerData.discordUrl || '').trim(),
            discordEnabled: Boolean(footerData.discordEnabled),
            updatedBy: adminProfile?.name || adminProfile?.nickname || 'Super Admin',
            updatedAt: new Date().toISOString()
          })
        })
      });

      // Audit Log
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            user_id: adminProfile?.uuid || null,
            batch_id: null,
            questions_scanned: 0,
            status: 'LOG: ' + JSON.stringify({
              action: 'SET_FOOTER_CONFIG',
              user_name: adminProfile?.name || 'Admin',
              user_avatar: adminProfile?.avatar || '👑',
              user_role: 'admin',
              batch_name: 'ระบบส่วนกลาง',
              batch_category: 'ตั้งค่าเว็บไซต์',
              question_count: 0,
              details: 'อัปเดตข้อมูล Footer และช่องทางติดต่อโซเชียลมีเดีย',
              timestamp: new Date().toISOString()
            })
          })
        });
      } catch (e) {}

      return res.status(200).json({ success: true, message: 'บันทึกการตั้งค่า Footer และเว็บไซต์เรียบร้อยแล้ว' });
    }

    // -------------------------------------------------------------
    // Branch 2: Resolve a Flagged Question (Admin Action)
    // -------------------------------------------------------------
    if (flag === 'resolve_flag') {
      if (!flagLedgerId) return res.status(400).json({ error: 'Missing flagLedgerId' });
      await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: adminProfile?.uuid || null,
          batch_id: batchId || null,
          questions_scanned: 0,
          status: 'RESOLVE_FLAG:' + JSON.stringify({
            flag_ledger_id: flagLedgerId,
            resolution_note: resolutionNote || 'ตรวจสอบและแก้ไขเรียบร้อยแล้ว',
            resolved_by: adminProfile?.name || adminProfile?.nickname || 'Admin 👑',
            resolved_at: new Date().toISOString()
          })
        })
      });
      return res.status(200).json({ success: true, message: 'บันทึกการตรวจสอบเรียบร้อยแล้ว' });
    }

    // -------------------------------------------------------------
    // Branch 3: Unhide / Unblock an auto-hidden batch (Admin Action)
    // -------------------------------------------------------------
    if (flag === 'unhide_batch') {
      if (!batchId) return res.status(400).json({ error: 'Missing batchId' });
      const bRes = await fetch(`${SUPABASE_URL}/rest/v1/batches?id=eq.${encodeURIComponent(batchId)}&select=*`, { headers });
      const bData = await bRes.json();
      if (!bData || bData.length === 0) return res.status(404).json({ error: 'Batch not found' });
      const batch = bData[0];

      const sourceFiles = Array.isArray(batch.source_files) ? [...batch.source_files] : [];
      const metaIdx = sourceFiles.findIndex(f => f && f._meta);
      const currentMeta = metaIdx >= 0 ? sourceFiles[metaIdx] : { _meta: true };
      const updatedMeta = { ...currentMeta, is_hidden: false, auto_hidden: false, _meta: true };
      if (metaIdx >= 0) sourceFiles[metaIdx] = updatedMeta;
      else sourceFiles.push(updatedMeta);

      await fetch(`${SUPABASE_URL}/rest/v1/batches?id=eq.${encodeURIComponent(batchId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ source_files: sourceFiles, updated_at: new Date().toISOString() })
      });

      // Audit Log for Unhide
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            user_id: adminProfile?.uuid || null,
            batch_id: batchId,
            questions_scanned: batch.total_questions || 0,
            status: 'LOG: ' + JSON.stringify({
              action: 'UNHIDE_BATCH',
              user_name: adminProfile?.name || 'Admin',
              user_avatar: adminProfile?.avatar || '👑',
              user_role: 'admin',
              batch_name: batch.batch_name,
              batch_category: batch.batch_category,
              question_count: batch.total_questions || 0,
              details: 'ปลดบล็อกและเปิดแสดงชุดข้อสอบในคลังสาธารณะอีกครั้ง หลังตรวจสอบแก้ไขแล้ว',
              timestamp: new Date().toISOString()
            })
          })
        });
      } catch (e) {}

      return res.status(200).json({ success: true, is_hidden: false });
    }

    // -------------------------------------------------------------
    // For other operations, batchId is required
    // -------------------------------------------------------------
    if (!batchId) return res.status(400).json({ error: 'Missing batchId' });

    const bRes = await fetch(`${SUPABASE_URL}/rest/v1/batches?id=eq.${encodeURIComponent(batchId)}&select=*`, { headers });
    const bData = await bRes.json();
    if (!bData || bData.length === 0) return res.status(404).json({ error: 'Batch not found' });
    const batch = bData[0];

    const sourceFiles = Array.isArray(batch.source_files) ? [...batch.source_files] : [];
    const metaIdx = sourceFiles.findIndex(f => f && f._meta);
    const currentMeta = metaIdx >= 0 ? sourceFiles[metaIdx] : { _meta: true };

    // -------------------------------------------------------------
    // Branch 4: Report question issue (Learner Action)
    // -------------------------------------------------------------
    if (flag === 'report_question') {
      const currentFlagCount = (Number(currentMeta.flag_count) || 0) + 1;
      const willAutoHide = currentFlagCount >= 10;

      const updatedMeta = {
        ...currentMeta,
        flag_count: currentFlagCount,
        _meta: true
      };
      if (willAutoHide) {
        updatedMeta.is_hidden = true;
        updatedMeta.auto_hidden = true;
      }

      if (metaIdx >= 0) sourceFiles[metaIdx] = updatedMeta;
      else sourceFiles.push(updatedMeta);

      await fetch(`${SUPABASE_URL}/rest/v1/batches?id=eq.${encodeURIComponent(batchId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ source_files: sourceFiles, updated_at: new Date().toISOString() })
      });

      // Insert record to scan_ledger
      const repName = reporterProfile?.nickname || reporterProfile?.name || 'ผู้เรียน';
      const flagData = {
        batch_id: batchId,
        batch_name: batch.batch_name,
        question_index: questionIndex !== undefined ? Number(questionIndex) : 0,
        question_id: questionId || null,
        question_text: String(questionText || '').slice(0, 300),
        issue_type: issueType || 'ANSWER_WRONG',
        user_note: String(userNote || '').slice(0, 500),
        reporter_name: repName,
        reporter_avatar: reporterProfile?.avatar || '👤',
        created_at: new Date().toISOString()
      };

      const isUuid = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const validUserId = isUuid(reporterProfile?.uuid) ? reporterProfile.uuid : null;

      await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: validUserId,
          batch_id: batchId,
          questions_scanned: (Number(questionIndex) || 0) + 1,
          status: 'FLAG_QUESTION:' + JSON.stringify(flagData)
        })
      });

      // If Auto-Hidden (> 10), log into Audit Trail
      if (willAutoHide && !currentMeta.auto_hidden) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/scan_ledger`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              user_id: null,
              batch_id: batchId,
              questions_scanned: batch.total_questions || 0,
              status: 'LOG: ' + JSON.stringify({
                action: 'AUTO_HIDE_BATCH',
                user_name: 'ระบบความปลอดภัย QuizSilo 🤖',
                user_avatar: '🤖',
                user_role: 'system',
                batch_name: batch.batch_name,
                batch_category: batch.batch_category,
                question_count: batch.total_questions || 0,
                details: `ซ่อนชุดข้อสอบนี้จากคลังสาธารณะอัตโนมัติ เนื่องจากมีผู้ใช้รายงานข้อผิดพลาดสะสมครบ ${currentFlagCount} ครั้ง`,
                timestamp: new Date().toISOString()
              })
            })
          });
        } catch (e) {}
      }

      return res.status(200).json({
        success: true,
        batchId,
        flagCount: currentFlagCount,
        isAutoHidden: willAutoHide
      });
    }

    // -------------------------------------------------------------
    // Branch 5: Submit Star Rating
    // -------------------------------------------------------------
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

      if (metaIdx >= 0) sourceFiles[metaIdx] = updatedMeta;
      else sourceFiles.push(updatedMeta);

      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/batches?id=eq.${encodeURIComponent(batchId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ source_files: sourceFiles, updated_at: new Date().toISOString() })
      });

      if (!updateRes.ok) throw new Error(await updateRes.text());

      return res.status(200).json({
        success: true,
        batchId,
        rating_avg: ratingAvg,
        rating_count: ratingCount,
        user_rating: starVal
      });
    }

    // -------------------------------------------------------------
    // Branch 6: Toggle Batch Visibility or Pin
    // -------------------------------------------------------------
    if (!flag) return res.status(400).json({ error: 'Missing flag or rating' });

    const updatedMeta = { ...currentMeta, [flag]: Boolean(value), _meta: true };
    if (flag === 'is_hidden' && !value) {
      updatedMeta.auto_hidden = false;
    }

    if (metaIdx >= 0) sourceFiles[metaIdx] = updatedMeta;
    else sourceFiles.push(updatedMeta);

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/batches?id=eq.${encodeURIComponent(batchId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ source_files: sourceFiles, updated_at: new Date().toISOString() })
    });

    if (!updateRes.ok) throw new Error(await updateRes.text());

    // Audit Log for Flag change
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
    } catch (le) {}

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
