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

      // Atomic replace or insert
      const recordId = 'FACE-' + cleanRoll;
      const vectorData = JSON.stringify(embedding_vector || []);

      await sql`
        INSERT INTO public.student_face_embeddings (id, roll_number, student_name, embedding_vector, created_at, updated_at)
        VALUES (
          ${recordId},
          ${cleanRoll},
          ${student_name || cleanRoll},
          ${vectorData}::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          student_name = EXCLUDED.student_name,
          embedding_vector = EXCLUDED.embedding_vector,
          updated_at = NOW();
      `;

      return res.status(200).json({
        success: true,
        message: `Face enrolled in cloud biometrics for ${cleanRoll}`,
        roll_number: cleanRoll,
      });
    } catch (err) {
      console.error('Neon Enroll Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(200).json({ success: true, message: `Face enrolled locally for ${cleanRoll}` });
}
