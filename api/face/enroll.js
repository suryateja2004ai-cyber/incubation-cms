export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) {}
  }

  const { roll_number, student_name, embedding_vector } = body || {};
  if (!roll_number) {
    return res.status(400).json({ success: false, error: 'Roll number is required' });
  }

  const cleanRoll = String(roll_number).trim().toUpperCase();
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(dbUrl);

      // 1. Ensure table exists without incompatible columns
      await sql`
        CREATE TABLE IF NOT EXISTS public.student_face_embeddings (
          id text PRIMARY KEY,
          roll_number text NOT NULL,
          student_name text NOT NULL,
          embedding_vector jsonb NOT NULL,
          created_at timestamptz DEFAULT now()
        );
      `;

      // 2. Resolve real student name from passwords table or auto-provision account
      const userRows = await sql`
        SELECT student_name FROM public.passwords 
        WHERE UPPER(TRIM(roll_number)) = ${cleanRoll} 
        LIMIT 1;
      `;
      let resolvedName = student_name;
      if (userRows && userRows.length > 0 && userRows[0].student_name) {
        resolvedName = userRows[0].student_name;
      } else {
        if (!resolvedName) resolvedName = `Student ${cleanRoll}`;
        await sql`
          INSERT INTO public.passwords (
            roll_number, password, student_name, role, department, 
            phone_number, created_at, updated_at, academic_year_at_start, 
            incubation_start_date, retention_period_years, retention_end_date
          ) VALUES (
            ${cleanRoll},
            'student123',
            ${resolvedName},
            'student',
            'ECE',
            '9876543210',
            NOW(),
            NOW(),
            1,
            NOW(),
            4,
            NOW() + INTERVAL '4 years'
          )
          ON CONFLICT (roll_number) DO UPDATE SET
            student_name = COALESCE(EXCLUDED.student_name, public.passwords.student_name);
        `;
      }

      // 3. Upsert face embedding
      const recordId = 'FACE-' + cleanRoll;
      const vectorData = JSON.stringify(embedding_vector || []);

      await sql`
        INSERT INTO public.student_face_embeddings (id, roll_number, student_name, embedding_vector, created_at)
        VALUES (
          ${recordId},
          ${cleanRoll},
          ${resolvedName},
          ${vectorData}::jsonb,
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          student_name = EXCLUDED.student_name,
          embedding_vector = EXCLUDED.embedding_vector;
      `;

      return res.status(200).json({
        success: true,
        message: `Face enrolled in cloud biometrics for ${cleanRoll}`,
        roll_number: cleanRoll,
        student_name: resolvedName,
      });
    } catch (err) {
      console.error('Neon Enroll Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(200).json({ success: true, message: `Face enrolled locally for ${cleanRoll}` });
}
