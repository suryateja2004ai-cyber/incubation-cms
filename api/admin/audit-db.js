export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(200).json({ success: false, error: 'No DATABASE_URL configured' });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(dbUrl);

    const urlObj = new URL(req.url || '/', 'http://localhost');
    const action = req.query?.action || urlObj.searchParams.get('action');

    // Auto-reconcile database records
    if (action === 'reconcile') {
      // 1. Correct Harsha Vardhan
      await sql`
        UPDATE public.passwords
        SET student_name = 'Harsha Vardhan', email = '238w1a0477@vrsec.ac.in', department = 'ECE', updated_at = NOW()
        WHERE UPPER(TRIM(roll_number)) = '238W1A0477';
      `;
      // 2. Insert Hema Priya if missing
      const hemaCheck = await sql`SELECT id FROM public.passwords WHERE UPPER(TRIM(roll_number)) = '238W1A0481';`;
      if (!hemaCheck || hemaCheck.length === 0) {
        await sql`
          INSERT INTO public.passwords (
            roll_number, password, student_name, role, department, 
            phone_number, email, created_at, updated_at, academic_year_at_start, 
            incubation_start_date, retention_period_years, retention_end_date
          ) VALUES (
            '238W1A0481', 'student123', 'Hema Priya', 'student', 'ECE',
            '9876543213', '238w1a0481@vrsec.ac.in', NOW(), NOW(), 1, CURRENT_DATE, 4, CURRENT_DATE + INTERVAL '4 years'
          );
        `;
      }
      // 3. Sync face embeddings
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
      // 4. Sync issued components, projects, research
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

      return res.status(200).json({
        success: true,
        message: 'Neon database reconciliation complete: Harsha Vardhan (238W1A0477) and Hema Priya (238W1A0481) 100% synchronized.',
      });
    }

    // 1. List all tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;

    // 2. Fetch all passwords
    const passwords = await sql`
      SELECT id, roll_number, student_name, email, role, department, phone_number 
      FROM public.passwords 
      ORDER BY id;
    `;

    // 3. Fetch visitor_attendance
    let visitors = [];
    try {
      visitors = await sql`SELECT * FROM public.visitor_attendance ORDER BY id DESC LIMIT 50;`;
    } catch (e) {
      visitors = [{ error: e.message }];
    }

    // 4. Fetch face embeddings
    let faceEmbeddings = [];
    try {
      faceEmbeddings = await sql`SELECT id, roll_number, student_name, created_at FROM public.student_face_embeddings ORDER BY created_at DESC;`;
    } catch (e) {
      faceEmbeddings = [{ error: e.message }];
    }

    // 5. Fetch issued components
    let issued = [];
    try {
      issued = await sql`SELECT id, registration_number, student_name, phone_number, status FROM public.issued_components ORDER BY issue_date DESC LIMIT 50;`;
    } catch (e) {
      issued = [{ error: e.message }];
    }

    // 6. Search for any discrepancies or matches
    const searchParam = req.query?.search || urlObj.searchParams.get('search') || '238W1A0481';
    let searchResults = {};
    if (searchParam) {
      const q = `%${searchParam}%`;
      const pMatches = await sql`SELECT id, roll_number, student_name, email FROM public.passwords WHERE roll_number ILIKE ${q} OR student_name ILIKE ${q};`;
      const vMatches = await sql`SELECT id, full_name, phone_number FROM public.visitor_attendance WHERE full_name ILIKE ${q} OR visitor_id ILIKE ${q};`;
      const fMatches = await sql`SELECT id, roll_number, student_name, created_at FROM public.student_face_embeddings WHERE roll_number ILIKE ${q} OR student_name ILIKE ${q};`;
      const iMatches = await sql`SELECT id, registration_number, student_name, phone_number, status FROM public.issued_components WHERE registration_number ILIKE ${q} OR student_name ILIKE ${q};`;
      searchResults = { passwords_matches: pMatches, visitors_matches: vMatches, face_matches: fMatches, issued_matches: iMatches };
    }

    return res.status(200).json({
      success: true,
      tables: tables.map((t) => t.table_name),
      passwords,
      visitors,
      faceEmbeddings,
      issued,
      searchResults,
    });
  } catch (err) {
    console.error('Neon audit error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
