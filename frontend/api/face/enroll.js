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
    return res.status(400).json({ error: 'Roll number is required' });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(dbUrl);
      await sql`
        INSERT INTO public.student_face_embeddings (id, roll_number, student_name, embedding_vector, created_at)
        VALUES (
          ${'FACE-' + roll_number + '-' + Date.now()}, 
          ${roll_number.toUpperCase()}, 
          ${student_name || roll_number}, 
          ${JSON.stringify(embedding_vector || [])}::jsonb, 
          NOW()
        )
        ON CONFLICT (id) DO NOTHING;
      `;
    } catch (err) {
      console.error('Neon Enroll Error:', err);
    }
  }

  return res.status(200).json({ success: true, message: 'Face enrolled in cloud biometrics' });
}
