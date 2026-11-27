export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(200).json({ success: true, embeddings: [] });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(dbUrl);

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT roll_number, student_name, embedding_vector, created_at 
        FROM public.student_face_embeddings 
        ORDER BY created_at DESC;
      `;
      return res.status(200).json({ success: true, embeddings: rows || [] });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) {}
      }
      const { roll_number, student_name, embedding_vector } = body || {};
      if (!roll_number) {
        return res.status(400).json({ success: false, error: 'Roll number is required' });
      }

      await sql`
        INSERT INTO public.student_face_embeddings (id, roll_number, student_name, embedding_vector, created_at)
        VALUES (
          ${'FACE-' + roll_number.toUpperCase() + '-' + Date.now()},
          ${roll_number.toUpperCase()},
          ${student_name || roll_number},
          ${JSON.stringify(embedding_vector || [])}::jsonb,
          NOW()
        )
        ON CONFLICT (id) DO NOTHING;
      `;
      return res.status(200).json({ success: true, message: 'Embedding saved' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Neon embeddings API error:', err);
    return res.status(200).json({ success: true, embeddings: [] });
  }
}
