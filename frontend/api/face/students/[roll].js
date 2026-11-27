export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const rollParam = req.query?.roll || '';
  const cleanRoll = String(rollParam).trim().toUpperCase();

  if (!cleanRoll) {
    return res.status(400).json({ registered: false, count: 0, error: 'Roll number is required' });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(200).json({ registered: false, count: 0 });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(dbUrl);

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT roll_number, student_name, created_at
        FROM public.student_face_embeddings 
        WHERE UPPER(TRIM(roll_number)) = ${cleanRoll} 
        LIMIT 1;
      `;
      const isRegistered = rows && rows.length > 0;
      return res.status(200).json({
        registered: isRegistered,
        count: isRegistered ? 10 : 0,
        embedding_count: isRegistered ? 10 : 0,
        student_name: isRegistered ? rows[0].student_name : null,
        created_at: isRegistered ? rows[0].created_at : null,
      });
    }

    if (req.method === 'DELETE') {
      await sql`
        DELETE FROM public.student_face_embeddings 
        WHERE UPPER(TRIM(roll_number)) = ${cleanRoll};
      `;
      return res.status(200).json({ success: true, message: `Face biometrics deleted for ${cleanRoll}` });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    console.error(`Neon student face API error for ${cleanRoll}:`, err);
    return res.status(500).json({ registered: false, count: 0, error: err.message });
  }
}
