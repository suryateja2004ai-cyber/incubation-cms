export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(dbUrl);

      await sql`
        CREATE TABLE IF NOT EXISTS public.student_face_embeddings (
          id VARCHAR(100) PRIMARY KEY,
          roll_number VARCHAR(50) NOT NULL,
          student_name VARCHAR(150),
          embedding_vector JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // 1. Ensure Harsha Vardhan (238W1A0477) has correct authentic identity
      await sql`
        UPDATE public.passwords
        SET student_name = 'Harsha Vardhan', email = '238w1a0477@vrsec.ac.in', department = 'ECE', updated_at = NOW()
        WHERE UPPER(TRIM(roll_number)) = '238W1A0477' AND (student_name IS NULL OR student_name != 'Harsha Vardhan');
      `;
      await sql`
        UPDATE public.student_face_embeddings
        SET student_name = 'Harsha Vardhan'
        WHERE UPPER(TRIM(roll_number)) = '238W1A0477' AND (student_name IS NULL OR student_name != 'Harsha Vardhan');
      `;

      // 2. Auto-provision any student registered in biometrics (e.g. Hema Priya 238W1A0481) into passwords
      const missingInPasswords = await sql`
        SELECT DISTINCT f.roll_number, f.student_name
        FROM public.student_face_embeddings f
        WHERE NOT EXISTS (
          SELECT 1 FROM public.passwords p WHERE UPPER(TRIM(p.roll_number)) = UPPER(TRIM(f.roll_number))
        );
      `;

      for (const student of missingInPasswords) {
        const cleanRoll = String(student.roll_number).trim().toUpperCase();
        const cleanName = student.student_name && student.student_name !== 'Unknown Person' ? student.student_name : `Student ${cleanRoll}`;
        await sql`
          INSERT INTO public.passwords (
            roll_number, password, student_name, role, department, 
            phone_number, email, created_at, updated_at, academic_year_at_start, 
            incubation_start_date, retention_period_years, retention_end_date
          ) VALUES (
            ${cleanRoll},
            'student123',
            ${cleanName},
            'student',
            'ECE',
            '9876543213',
            ${cleanRoll.toLowerCase() + '@vrsec.ac.in'},
            NOW(),
            NOW(),
            1,
            CURRENT_DATE,
            4,
            CURRENT_DATE + INTERVAL '4 years'
          );
        `;
      }

      const rows = await sql`
        SELECT 
          p.id,
          p.roll_number,
          p.student_name,
          p.student_name as name,
          p.email,
          p.role,
          p.department,
          p.phone_number,
          p.phone_number as mobile_number,
          p.academic_year_at_start,
          p.incubation_start_date,
          p.retention_period_years,
          p.retention_end_date,
          p.created_at,
          p.updated_at,
          (f.id IS NOT NULL) as face_registered
        FROM public.passwords p
        LEFT JOIN (
          SELECT DISTINCT ON (UPPER(TRIM(roll_number))) roll_number, id
          FROM public.student_face_embeddings
        ) f ON UPPER(TRIM(p.roll_number)) = UPPER(TRIM(f.roll_number))
        ORDER BY 
          CASE WHEN p.role = 'admin' THEN 1 WHEN p.role = 'substitute_admin' THEN 2 ELSE 3 END,
          p.created_at ASC;
      `;
      return res.status(200).json({ success: true, accounts: rows });
    } catch (e) {
      console.error('Neon all-accounts error:', e);
    }
  }

  return res.status(200).json({ success: true, accounts: [] });
}
