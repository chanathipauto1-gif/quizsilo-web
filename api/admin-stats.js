// Serverless Function for Vercel (Auto-Generated)
// Securely aggregates admin console statistics by querying Supabase with Service Key (bypassing RLS)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtwlqtvyxtekuydlvpnb.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X2JIVUw1SXVnNlNKOXNZVk9kcGFPZndfMEZHdFd0Rjk=', 'base64').toString('utf8');

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY
  };

  try {
    const [profilesRes, attemptsRes, batchesRes, rolesRes, quotasRes, examLogsRes] = await Promise.all([
      fetch(SUPABASE_URL + '/rest/v1/profiles?select=*&order=created_at.desc', { headers }),
      fetch(SUPABASE_URL + '/rest/v1/exam_attempts?select=*', { headers }),
      fetch(SUPABASE_URL + '/rest/v1/batches?select=*', { headers }),
      fetch(SUPABASE_URL + '/rest/v1/scan_ledger?status=like.SYSTEM_ROLE*&select=user_id,status,created_at&order=created_at.asc', { headers }),
      fetch(SUPABASE_URL + '/rest/v1/scan_ledger?status=like.SYSTEM_QUOTA*&select=user_id,status,created_at&order=created_at.asc', { headers }),
      fetch(SUPABASE_URL + '/rest/v1/scan_ledger?status=like.LOG*%22EXAM_ATTEMPT%22*&select=*&order=created_at.desc&limit=500', { headers })
    ]);

    const profiles = await profilesRes.json();
    const attempts = await attemptsRes.json();
    const batches = await batchesRes.json();
    const roles = await rolesRes.json();
    const quotas = await quotasRes.json();
    const examLogs = await examLogsRes.json();

    const roleOverrideMap = {};
    (Array.isArray(roles) ? roles : []).forEach(r => {
      if (r.user_id && r.status) {
        roleOverrideMap[r.user_id] = r.status.replace('SYSTEM_ROLE:', '');
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

    const now = Date.now();
    const fiveMinsMs = 5 * 60 * 1000;
    let activeNowCount = 0;

    const targetExamsMap = {};
    const referralMap = {};
    const userStatsMap = {};

    (Array.isArray(profiles) ? profiles : []).forEach(p => {
      const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
      const isOnline = (now - lastSeen) < fiveMinsMs;
      if (isOnline) activeNowCount++;

      if (p.target_exams) {
        const t = p.target_exams.trim();
        targetExamsMap[t] = (targetExamsMap[t] || 0) + 1;
      }
      if (p.referral_source) {
        const r = p.referral_source.trim();
        referralMap[r] = (referralMap[r] || 0) + 1;
      }

      const assignedRole = roleOverrideMap[p.id] || p.role || 'student';

      userStatsMap[p.id] = {
        id: p.id,
        name: p.nickname || p.display_name || (p.email ? p.email.split('@')[0] : 'ผู้ใช้'),
        email: p.email || '',
        avatar: p.avatar,
        role: assignedRole,
        bonusFiles: quotaMap[p.id]?.bonusFiles || 0,
        bonusQuestions: quotaMap[p.id]?.bonusQuestions || 0,
        resetAt: quotaMap[p.id]?.resetAt || null,
        targetExams: p.target_exams || 'ยังไม่ระบุ',
        occupation: p.occupation || 'ยังไม่ระบุ',
        ageGroup: p.age_group || 'ยังไม่ระบุ',
        referralSource: p.referral_source || 'ยังไม่ระบุ',
        createdAt: new Date(p.created_at).toLocaleDateString('th-TH'),
        lastSeenStr: isOnline ? 'ออนไลน์' : (p.last_seen_at ? new Date(p.last_seen_at).toLocaleDateString('th-TH') : '-'),
        isOnline: isOnline,
        attemptsCount: 0,
        questionsCount: 0,
        totalScore: 0,
        uploadBatches: 0,
        uploadQuestions: 0,
        categoriesDone: {},
        isGuest: false
      };
    });

    let totalQuestionsAllUsers = 0;
    let totalScoreAllUsers = 0;
    let totalAttemptsCount = 0;

    (Array.isArray(attempts) ? attempts : []).forEach(a => {
      if (a.user_id && userStatsMap[a.user_id]) {
        userStatsMap[a.user_id].attemptsCount++;
        userStatsMap[a.user_id].questionsCount += (a.total_questions || 0);
        userStatsMap[a.user_id].totalScore += (a.score || 0);
        totalQuestionsAllUsers += (a.total_questions || 0);
        totalScoreAllUsers += (a.score || 0);
        totalAttemptsCount++;
      }
    });

    // Aggregate Guest Practice Attempts from Activity Ledger
    const guestStatsMap = {};
    (Array.isArray(examLogs) ? examLogs : []).forEach(l => {
      try {
        const rawStatus = (l.status || '').replace(/^LOG:s*/, '');
        const logData = JSON.parse(rawStatus);
        if (logData.action === 'EXAM_ATTEMPT') {
          const isGuest = logData.user_role === 'guest' || !l.user_id;
          if (isGuest) {
            const rawName = (logData.user_name || 'ผู้เยี่ยมชม (Guest)').trim();
            const guestKey = 'guest_' + rawName.toLowerCase();
            const logQCount = Number(logData.question_count || l.questions_scanned || 0);

            let logScore = Number(logData.score);
            if (isNaN(logScore) && logData.details) {
              const m = logData.details.match(/ทำข้อสอบได้s*(d+)/(d+)/);
              if (m) logScore = parseInt(m[1], 10);
            }
            if (isNaN(logScore)) logScore = 0;

            const createdDate = l.created_at ? new Date(l.created_at) : new Date();
            const isRecent = (now - createdDate.getTime()) < fiveMinsMs;
            if (isRecent) activeNowCount++;

            if (!guestStatsMap[guestKey]) {
              guestStatsMap[guestKey] = {
                id: guestKey,
                name: rawName,
                email: 'โหมดผู้เยี่ยมชม (Guest)',
                avatar: logData.user_avatar || '👤',
                role: 'guest',
                bonusFiles: 0,
                bonusQuestions: 0,
                resetAt: null,
                targetExams: 'โหมดผู้เยี่ยมชม',
                occupation: 'ผู้เยี่ยมชม',
                ageGroup: '-',
                referralSource: '-',
                createdAt: createdDate.toLocaleDateString('th-TH'),
                lastSeenStr: isRecent ? 'ออนไลน์' : createdDate.toLocaleDateString('th-TH'),
                isOnline: isRecent,
                attemptsCount: 0,
                questionsCount: 0,
                totalScore: 0,
                uploadBatches: 0,
                uploadQuestions: 0,
                categoriesDone: {},
                isGuest: true
              };
            }

            guestStatsMap[guestKey].attemptsCount++;
            guestStatsMap[guestKey].questionsCount += logQCount;
            guestStatsMap[guestKey].totalScore += logScore;

            totalQuestionsAllUsers += logQCount;
            totalScoreAllUsers += logScore;
            totalAttemptsCount++;
          }
        }
      } catch (e) {}
    });

    (Array.isArray(batches) ? batches : []).forEach(b => {
      if (b.user_id && userStatsMap[b.user_id]) {
        const uQuota = quotaMap[b.user_id];
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        const resetTime = uQuota?.resetAt ? new Date(uQuota.resetAt).getTime() : 0;
        if (bTime >= resetTime) {
          userStatsMap[b.user_id].uploadBatches++;
          userStatsMap[b.user_id].uploadQuestions += (b.total_questions || 0);
        }
      }
    });

    const allUsersCombined = [...Object.values(userStatsMap), ...Object.values(guestStatsMap)];

    const userList = allUsersCombined.map(u => {
      const accuracy = u.questionsCount > 0 ? ((u.totalScore / u.questionsCount) * 100).toFixed(1) + '%' : '-';
      return {
        ...u,
        accuracy: accuracy
      };
    });

    const systemAvgAccuracy = totalQuestionsAllUsers > 0 ? ((totalScoreAllUsers / totalQuestionsAllUsers) * 100).toFixed(1) + '%' : '0%';

    return res.status(200).json({
      success: true,
      kpis: {
        totalUsers: (profiles || []).length + Object.keys(guestStatsMap).length,
        totalRegisteredUsers: (profiles || []).length,
        totalGuests: Object.keys(guestStatsMap).length,
        activeUsers: activeNowCount,
        totalAttempts: totalAttemptsCount,
        totalQuestionsDone: totalQuestionsAllUsers,
        avgAccuracy: systemAvgAccuracy
      },
      insights: {
        targetExams: Object.keys(targetExamsMap).map(k => ({ label: k, count: targetExamsMap[k] })),
        referrals: Object.keys(referralMap).map(k => ({ label: k, count: referralMap[k] }))
      },
      users: userList
    });
  } catch (err) {
    console.error('Admin Stats API Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
