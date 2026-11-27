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
      const rows = await sql`
        SELECT 
          id,
          roll_number,
          student_name as name,
          email,
          role,
          department,
          phone_number as mobile_number,
          academic_year_at_start,
          incubation_start_date,
          retention_period_years,
          retention_end_date,
          created_at,
          updated_at
        FROM public.passwords
        ORDER BY 
          CASE WHEN role = 'admin' THEN 1 WHEN role = 'substitute_admin' THEN 2 ELSE 3 END,
          created_at ASC;
      `;
      return res.status(200).json({ success: true, accounts: rows });
    } catch (e) {
      console.error('Neon all-accounts error:', e);
    }
  }

  return res.status(200).json({ success: true, accounts: [] });
}
