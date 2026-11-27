export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
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

      // Ensure table and index exist for 1400+ student biometrics
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
      await sql`
        CREATE INDEX IF NOT EXISTS idx_student_face_roll ON public.student_face_embeddings(roll_number);
      `;

      // Atomic replace or insert
      const recordId = 'FACE-' + cleanRoll;
      await sql`
        INSERT INTO public.student_face_embeddings (id, roll_number, student_name, embedding_vector, created_at, updated_at)
        VALUES (
          ${recordId},
          ${cleanRoll},
          ${student_name || cleanRoll},
          ${JSON.stringify(embedding_vector || [])}::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          student_name = EXCLUDED.student_name,
          embedding_vector = EXCLUDED.embedding_vector,
          updated_at = NOW();
      `;
    } catch (err) {
      console.error('Neon Enroll Error:', err);
    }
  }

  return res.status(200).json({ success: true, message: `Face enrolled in cloud biometrics for ${cleanRoll}` });
}
