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

  const { identifier, password } = body || {};
  const cleanId = String(identifier || '').trim();
  const cleanPass = String(password || '').trim();

  if (!cleanId || !cleanPass) {
    return res.status(400).json({ success: false, error: 'Please enter username and password.' });
  }

  // 1. Neon Database Query
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(dbUrl);
      const rows = await sql`
        SELECT * FROM public.passwords 
        WHERE LOWER(TRIM(roll_number)) = LOWER(TRIM(${cleanId})) 
        LIMIT 1;
      `;
      if (rows && rows.length > 0) {
        const userRow = rows[0];
        if (userRow.password !== cleanPass) {
          return res.status(401).json({ success: false, error: 'wrong password' });
        }
        return res.status(200).json({
          success: true,
          user: {
            id: userRow.roll_number,
            username: userRow.roll_number,
            rollNumber: userRow.role === 'student' ? userRow.roll_number : '',
            name: userRow.student_name,
            role: userRow.role || 'student',
            department: userRow.department || '',
            mobileNumber: userRow.phone_number || '',
          },
          message: 'Logged in successfully',
        });
      }
      return res.status(401).json({ success: false, error: 'Record not found. Please register first.' });
    } catch (dbErr) {
      console.error('Neon DB Error:', dbErr);
    }
  }

  // 2. Safe Fallback
  const knownAccounts = {
    'admin': { pass: 'admin123', name: 'Administrator', role: 'admin', dept: 'Incubation Management' },
    'subadmin': { pass: 'subadmin123', name: 'Sub-Administrator', role: 'substitute_admin', dept: 'Lab Operations' },
    '238w1a0477': { pass: '000000', name: 'Harsha Vardhan', role: 'student', dept: 'ECE' },
    '238w1a0401': { pass: 'student123', name: 'Aravind Kumar', role: 'student', dept: 'CSE' },
    '238w1a0499': { pass: 'password123', name: 'Suresh Kumar', role: 'student', dept: 'ECE' },
    '238w1a0455': { pass: 'password123', name: 'Pooja Sharma', role: 'student', dept: 'ECE' },
    '238w1a0466': { pass: 'studentpassword', name: 'Anil Kumar', role: 'student', dept: 'ECE' },
    '238w1a05f1': { pass: 'ABC123', name: 'KONKA', role: 'student', dept: 'ECE' },
    '238w1a0412': { pass: 'studentpassword123', name: 'M. Sreeja', role: 'student', dept: 'ECE' },
    '228w1a05g2': { pass: 'ABC321', name: 'RAJU', role: 'student', dept: 'ECE' },
  };

  const match = knownAccounts[cleanId.toLowerCase()];
  if (!match) {
    return res.status(401).json({ success: false, error: 'Record not found. Please register first.' });
  }
  if (match.pass !== cleanPass) {
    return res.status(401).json({ success: false, error: 'wrong password' });
  }

  return res.status(200).json({
    success: true,
    user: {
      id: cleanId,
      username: cleanId,
      rollNumber: match.role === 'student' ? cleanId.toUpperCase() : '',
      name: match.name,
      role: match.role,
      department: match.dept,
      mobileNumber: '9876543210',
    },
    message: 'Logged in successfully',
  });
}
