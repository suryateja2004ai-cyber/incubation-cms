// api/db/query.js
// Neon PostgreSQL Unified Cloud Data Engine
// Direct, zero-latency connection to Neon Serverless PostgreSQL

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(200).json({ success: false, error: 'No DATABASE_URL configured in environment' });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(dbUrl);

    // Auto-create visits table in Neon if missing
    await sql`
      CREATE TABLE IF NOT EXISTS public.visits (
        id VARCHAR(100) PRIMARY KEY,
        student_roll VARCHAR(50) NOT NULL,
        student_name VARCHAR(150),
        entry_time TIMESTAMPTZ NOT NULL,
        exit_time TIMESTAMPTZ,
        duration_minutes INTEGER,
        status VARCHAR(50) DEFAULT 'inside',
        entry_method VARCHAR(50) DEFAULT 'face',
        exit_method VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 1. Reconciliation action
    if (req.query?.action === 'reconcile') {
      // Correct Harsha Vardhan
      await sql`
        UPDATE public.passwords
        SET student_name = 'Harsha Vardhan', department = 'ECE', updated_at = NOW()
        WHERE UPPER(TRIM(roll_number)) = '238W1A0477';
      `;
      // Ensure Hema Priya exists
      const hemaCheck = await sql`SELECT id FROM public.passwords WHERE UPPER(TRIM(roll_number)) = '238W1A0481';`;
      if (!hemaCheck || hemaCheck.length === 0) {
        await sql`
          INSERT INTO public.passwords (
            roll_number, password, student_name, role, department, 
            phone_number, created_at, updated_at, academic_year_at_start, 
            incubation_start_date, retention_period_years, retention_end_date
          ) VALUES (
            '238W1A0481', 'student123', 'Hema Priya', 'student', 'ECE',
            '9876543213', NOW(), NOW(), 1, '2026-11-27', 4, '2030-11-27'
          );
        `;
      }
      // Sync biometrics
      await sql`
        UPDATE public.student_face_embeddings
        SET student_name = 'Harsha Vardhan'
        WHERE UPPER(TRIM(roll_number)) = '238W1A0477';
      `;
      await sql`
        UPDATE public.student_face_embeddings
        SET student_name = 'Hema Priya'
        WHERE UPPER(TRIM(roll_number)) = '238W1A0481';
      `;
      // Sync issued components and projects
      await sql`
        UPDATE public.issued_components
        SET student_name = 'Harsha Vardhan', updated_at = NOW()
        WHERE UPPER(TRIM(registration_number)) = '238W1A0477';
      `;
      await sql`
        UPDATE public.projects
        SET student_name = 'Harsha Vardhan', updated_at = NOW()
        WHERE UPPER(TRIM(student_roll)) = '238W1A0477';
      `;
      await sql`
        UPDATE public.research_publications
        SET student_name = 'Harsha Vardhan', updated_at = NOW()
        WHERE UPPER(TRIM(student_roll)) = '238W1A0477';
      `;

      return res.status(200).json({ success: true, message: 'Neon database reconciliation complete.' });
    }

    // 2. GET Table Data
    if (req.method === 'GET') {
      const table = (req.query?.table || '').trim().toLowerCase();
      let rows = [];

      switch (table) {
        case 'users':
        case 'passwords':
          rows = await sql`
            SELECT 
              p.id, p.roll_number, p.student_name, p.student_name as name,
              p.email, p.role, p.department, p.phone_number, p.phone_number as mobile_number,
              p.academic_year_at_start, p.incubation_start_date, p.retention_period_years,
              p.retention_end_date, p.created_at, p.updated_at,
              (f.id IS NOT NULL) as face_registered
            FROM public.passwords p
            LEFT JOIN public.student_face_embeddings f
              ON UPPER(TRIM(p.roll_number)) = UPPER(TRIM(f.roll_number))
            ORDER BY 
              CASE WHEN p.role = 'admin' THEN 1 WHEN p.role = 'substitute_admin' THEN 2 ELSE 3 END,
              p.created_at ASC;
          `;
          break;

        case 'visits':
          rows = await sql`
            SELECT 
              id, student_roll, student_name, entry_time, exit_time, 
              duration_minutes, status, entry_method, exit_method, created_at, updated_at
            FROM public.visits
            ORDER BY entry_time DESC
            LIMIT 200;
          `;
          break;

        case 'components':
          rows = await sql`
            SELECT * FROM public.components 
            ORDER BY id ASC;
          `;
          break;

        case 'transactions':
        case 'issued_components':
          rows = await sql`
            SELECT 
              id, registration_number as student_roll, student_name, phone_number,
              student_details, components, issue_date, overall_due_date,
              status, notes, issued_by, created_at, updated_at
            FROM public.issued_components
            ORDER BY created_at DESC;
          `;
          break;

        case 'projects':
          rows = await sql`SELECT * FROM public.projects ORDER BY created_at DESC;`;
          break;

        case 'research_papers':
        case 'research_publications':
          rows = await sql`SELECT * FROM public.research_publications ORDER BY created_at DESC;`;
          break;

        case 'achievements':
          rows = await sql`SELECT * FROM public.achievements ORDER BY date_awarded DESC;`;
          break;

        case 'events':
          rows = await sql`SELECT * FROM public.events ORDER BY event_date DESC;`;
          break;

        case 'announcements':
          rows = await sql`SELECT * FROM public.announcements ORDER BY created_at DESC;`;
          break;

        case 'complaints':
          rows = await sql`SELECT * FROM public.complaints ORDER BY created_at DESC;`;
          break;

        case 'teams':
          rows = await sql`SELECT * FROM public.teams ORDER BY created_at DESC;`;
          break;

        default:
          return res.status(200).json({ success: true, data: [] });
      }

      return res.status(200).json({ success: true, table, data: rows || [] });
    }

    // 3. POST / Mutate Table Data
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) {}
      }
      const { table, action, id, data } = body || {};

      if (!table) {
        return res.status(400).json({ success: false, error: 'Table is required' });
      }

      const tbl = table.trim().toLowerCase();

      // Mutate Visits
      if (tbl === 'visits') {
        if (action === 'insert' || action === 'upsert') {
          const v = data || {};
          const roll = (v.studentRoll || v.student_roll || '').trim().toUpperCase();
          const name = (v.studentName || v.student_name || '').trim();
          const entryTime = v.entryTime || v.entry_time || new Date().toISOString();
          const exitTime = v.exitTime || v.exit_time || null;
          const status = v.status || 'inside';
          const method = v.entryMethod || v.entry_method || 'face';
          const exitMethod = v.exitMethod || v.exit_method || null;
          const duration = v.durationMinutes || v.duration_minutes || null;

          await sql`
            INSERT INTO public.visits (
              id, student_roll, student_name, entry_time, exit_time,
              duration_minutes, status, entry_method, exit_method, created_at, updated_at
            ) VALUES (
              ${id || v.id},
              ${roll},
              ${name},
              ${entryTime},
              ${exitTime},
              ${duration},
              ${status},
              ${method},
              ${exitMethod},
              NOW(),
              NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              exit_time = EXCLUDED.exit_time,
              duration_minutes = EXCLUDED.duration_minutes,
              status = EXCLUDED.status,
              exit_method = EXCLUDED.exit_method,
              updated_at = NOW();
          `;
          return res.status(200).json({ success: true, message: 'Visit saved in Neon' });
        }
      }

      // Mutate Issued Components / Transactions
      if (tbl === 'transactions' || tbl === 'issued_components') {
        if (action === 'insert' || action === 'upsert') {
          const t = data || {};
          const roll = (t.studentRoll || t.registration_number || '').trim().toUpperCase();
          const name = (t.studentName || t.student_name || '').trim();
          const phone = t.phoneNumber || t.phone_number || '';
          const status = t.status || 'issued';
          const componentsJson = JSON.stringify(t.items || t.components || []);

          await sql`
            INSERT INTO public.issued_components (
              id, registration_number, student_name, phone_number, components,
              issue_date, overall_due_date, status, notes, issued_by, created_at, updated_at
            ) VALUES (
              ${id || t.id},
              ${roll},
              ${name},
              ${phone},
              ${componentsJson}::jsonb,
              ${t.issueDate || t.issue_date || new Date().toISOString()},
              ${t.overallDueDate || t.overall_due_date || new Date().toISOString()},
              ${status},
              ${t.notes || ''},
              ${t.issuedBy || t.issued_by || 'Admin'},
              NOW(),
              NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              components = EXCLUDED.components,
              student_name = EXCLUDED.student_name,
              updated_at = NOW();
          `;
          return res.status(200).json({ success: true, message: 'Transaction saved in Neon' });
        }
      }

      return res.status(200).json({ success: true, message: 'Mutation acknowledged' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Neon DB Query Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
