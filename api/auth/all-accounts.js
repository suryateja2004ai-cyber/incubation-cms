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
        LEFT JOIN public.student_face_embeddings f
          ON UPPER(TRIM(p.roll_number)) = UPPER(TRIM(f.roll_number))
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
