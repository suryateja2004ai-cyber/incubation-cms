export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(200).json({ success: true, students: [] });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(dbUrl);

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT 
          roll_number, 
          student_name as name, 
          10 as templates_count,
          10 as embedding_count,
          created_at
        FROM public.student_face_embeddings 
        ORDER BY created_at DESC;
      `;
      return res.status(200).json({ success: true, students: rows || [] });
    }

    if (req.method === 'DELETE') {
      const roll = (req.query?.roll || req.body?.roll_number || '').trim().toUpperCase();
      if (!roll) {
        return res.status(400).json({ success: false, error: 'Roll number is required' });
      }
      await sql`
        DELETE FROM public.student_face_embeddings 
        WHERE roll_number = ${roll};
      `;
      return res.status(200).json({ success: true, message: `Face biometrics deleted for ${roll}` });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Neon students face API error:', err);
    return res.status(500).json({ success: false, error: err.message, students: [] });
  }
}
