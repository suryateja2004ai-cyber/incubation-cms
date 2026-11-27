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

    // 1. Correct Harsha Vardhan in public.passwords
    await sql`
      UPDATE public.passwords
      SET 
        student_name = 'Harsha Vardhan',
        department = 'ECE',
        updated_at = NOW()
      WHERE UPPER(TRIM(roll_number)) = '238W1A0477';
    `;

    // 2. Ensure Hema Priya exists in public.passwords so she appears in Students & Accounts
    const hemaCheck = await sql`
      SELECT id FROM public.passwords WHERE UPPER(TRIM(roll_number)) = '238W1A0481';
    `;
    if (!hemaCheck || hemaCheck.length === 0) {
      await sql`
        INSERT INTO public.passwords (
          roll_number, password, student_name, role, department, 
          phone_number, created_at, updated_at, academic_year_at_start, 
          incubation_start_date, retention_period_years, retention_end_date
        ) VALUES (
          '238W1A0481',
          'student123',
          'Hema Priya',
          'student',
          'ECE',
          '9876543213',
          NOW(),
          NOW(),
          1,
          '2026-11-27',
          4,
          '2030-11-27'
        );
      `;
    } else {
      await sql`
        UPDATE public.passwords
        SET student_name = 'Hema Priya', department = 'ECE', updated_at = NOW()
        WHERE UPPER(TRIM(roll_number)) = '238W1A0481';
      `;
    }

    // 3. Ensure student_face_embeddings match authentic student names
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

    // 4. Correct student_name in issued_components transactions
    await sql`
      UPDATE public.issued_components
      SET student_name = 'Harsha Vardhan', updated_at = NOW()
      WHERE UPPER(TRIM(registration_number)) = '238W1A0477';
    `;

    // 5. Query updated passwords and face embeddings to verify
    const updatedPasswords = await sql`
      SELECT id, roll_number, student_name, email, role, department, phone_number 
      FROM public.passwords 
      ORDER BY id;
    `;
    const updatedEmbeddings = await sql`
      SELECT id, roll_number, student_name, created_at 
      FROM public.student_face_embeddings;
    `;

    return res.status(200).json({
      success: true,
      message: 'Database reconciliation complete: Harsha Vardhan and Hema Priya synchronized 100% across all tables.',
      passwords: updatedPasswords,
      embeddings: updatedEmbeddings,
    });
  } catch (err) {
    console.error('Reconciliation error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
