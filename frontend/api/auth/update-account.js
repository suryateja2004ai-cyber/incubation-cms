export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) {}
  }

  const {
    roll_number,
    student_name,
    email,
    department,
    phone_number,
    academic_year_at_start,
    incubation_start_date,
  } = body || {};

  if (!roll_number) {
    return res.status(400).json({ success: false, error: 'Account identifier is required.' });
  }

  const cleanRoll = String(roll_number).trim();
  const startYear = academic_year_at_start ? Number(academic_year_at_start) : null;
  const startDate = incubation_start_date ? String(incubation_start_date).slice(0, 10) : null;

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(dbUrl);

      const rows = await sql`
        UPDATE public.passwords
        SET 
          student_name = COALESCE(${student_name || null}, student_name),
          email = ${email !== undefined ? (email ? String(email).trim().toLowerCase() : '') : ''},
          department = COALESCE(${department || null}, department),
          phone_number = COALESCE(${phone_number || null}, phone_number),
          academic_year_at_start = COALESCE(${startYear}, academic_year_at_start),
          incubation_start_date = COALESCE(${startDate}, incubation_start_date),
          updated_at = NOW()
        WHERE LOWER(TRIM(roll_number)) = LOWER(TRIM(${cleanRoll}))
        RETURNING id, roll_number, student_name, email, role, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date;
      `;

      if (rows && rows.length > 0) {
        return res.status(200).json({
          success: true,
          message: 'Account details and retention plan updated successfully!',
          account: rows[0],
        });
      }
    } catch (dbErr) {
      console.error('Neon update-account error:', dbErr);
      return res.status(500).json({ success: false, error: dbErr.message });
    }
  }

  return res.status(200).json({
    success: true,
    message: 'Account details updated successfully!',
  });
}
