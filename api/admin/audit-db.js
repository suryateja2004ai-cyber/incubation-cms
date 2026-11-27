export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(200).json({ success: false, error: 'No DATABASE_URL configured' });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(dbUrl);

    // 1. List all tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;

    // 2. Fetch all passwords
    const passwords = await sql`
      SELECT id, roll_number, student_name, email, role, department, phone_number 
      FROM public.passwords 
      ORDER BY id;
    `;

    // 3. Fetch visitor_attendance
    let visitors = [];
    try {
      visitors = await sql`SELECT * FROM public.visitor_attendance ORDER BY id DESC LIMIT 50;`;
    } catch (e) {
      visitors = [{ error: e.message }];
    }

    // 4. Fetch face embeddings
    let faceEmbeddings = [];
    try {
      faceEmbeddings = await sql`SELECT id, roll_number, student_name, created_at FROM public.student_face_embeddings;`;
    } catch (e) {
      faceEmbeddings = [{ error: e.message }];
    }

    // 5. Fetch issued components
    let issued = [];
    try {
      issued = await sql`SELECT id, registration_number, student_name, phone_number, status FROM public.issued_components LIMIT 50;`;
    } catch (e) {
      issued = [{ error: e.message }];
    }

    // 6. Search across all tables for 'hema' or 'priya'
    const searchResults = {
      passwords_matches: passwords.filter(p => /hema|priya/i.test(JSON.stringify(p))),
      visitors_matches: visitors.filter(v => /hema|priya/i.test(JSON.stringify(v))),
      face_matches: faceEmbeddings.filter(f => /hema|priya/i.test(JSON.stringify(f))),
      issued_matches: issued.filter(i => /hema|priya/i.test(JSON.stringify(i))),
    };

    return res.status(200).json({
      success: true,
      tables: tables.map(t => t.table_name),
      passwords,
      visitors,
      faceEmbeddings,
      issued,
      searchResults,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
