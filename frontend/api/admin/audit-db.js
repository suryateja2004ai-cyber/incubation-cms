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

    // 1. Unconditional auto-reconciliation: Always ensure Harsha Vardhan is accurate
    await sql`
      UPDATE public.passwords
      SET student_name = 'Harsha Vardhan', email = '238w1a0477@vrsec.ac.in', department = 'ECE', updated_at = NOW()
      WHERE UPPER(TRIM(roll_number)) = '238W1A0477';
    `;
    await sql`
      UPDATE public.student_face_embeddings
      SET student_name = 'Harsha Vardhan'
      WHERE UPPER(TRIM(roll_number)) = '238W1A0477';
    `;
    await sql`
      UPDATE public.issued_components
      SET student_name = 'Harsha Vardhan', updated_at = NOW()
      WHERE UPPER(TRIM(registration_number)) = '238W1A0477';
    `;

    // 2. Unconditional auto-reconciliation: Always ensure Hema Priya exists in passwords & biometrics
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
    await sql`
      UPDATE public.student_face_embeddings
      SET student_name = 'Hema Priya'
      WHERE UPPER(TRIM(roll_number)) = '238W1A0481';
    `;

    // 3. List all tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;

    // 4. Fetch all passwords
    const passwords = await sql`
      SELECT id, roll_number, student_name, email, role, department, phone_number 
      FROM public.passwords 
      ORDER BY id;
    `;

    // 5. Fetch face embeddings
    let faceEmbeddings = [];
    try {
      faceEmbeddings = await sql`SELECT id, roll_number, student_name, created_at FROM public.student_face_embeddings ORDER BY created_at DESC;`;
    } catch (e) {
      faceEmbeddings = [{ error: e.message }];
    }

    return res.status(200).json({
      success: true,
      message: 'Reconciliation active and verified',
      tables: tables.map((t) => t.table_name),
      passwords,
      faceEmbeddings,
    });
  } catch (err) {
    console.error('Neon audit error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
