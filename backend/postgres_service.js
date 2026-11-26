// backend/postgres_service.js
// Direct PostgreSQL integration for Incubation Centre CMS:
// 1. Authentication (Student & Admin Login, Password Verification & Account Creation)
// 2. Issued Components & Returns Tracking
// 3. Power Consumption Tracking (Zone-wise & Device-by-Device)
// 4. Overdue Components Tracker (Scans issued_components end dates)
// 5. Shared Projects Showcase Repository
// 6. Shared Research Publications Repository
import { execFileSync } from 'child_process';

const PSQL_BIN = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
const DB_NAME = 'incubation_cms';
const DB_USER = 'postgres';
const DB_PORT = '5432';

/**
 * Execute raw SQL query against incubation_cms using psql
 */
export function queryPg(sql, params = []) {
  let formattedSql = sql;
  params.forEach((param, idx) => {
    let val;
    if (param === null || param === undefined) {
      val = 'NULL';
    } else if (typeof param === 'number' || typeof param === 'boolean') {
      val = String(param);
    } else if (typeof param === 'object') {
      val = `'${JSON.stringify(param).replace(/'/g, "''")}'::jsonb`;
    } else {
      val = `'${String(param).replace(/'/g, "''")}'`;
    }
    const placeholder = new RegExp(`\\$${idx + 1}(?!\\d)`, 'g');
    formattedSql = formattedSql.replace(placeholder, val);
  });

  const args = [
    '-U', DB_USER,
    '-d', DB_NAME,
    '-p', DB_PORT,
    '-t',
    '-A',
    '-c', formattedSql
  ];

  try {
    const stdout = execFileSync(PSQL_BIN, args, {
      env: { ...process.env, PGPASSWORD: 'postgres' },
      encoding: 'utf-8',
      windowsHide: true,
    });
    return stdout.trim();
  } catch (err) {
    console.error('[PostgreSQL Service Error]:', err.message, err.stderr || '');
    throw err;
  }
}

/* =====================================================================
   1. AUTHENTICATION & PASSWORDS TABLE
   ===================================================================== */

export function loginAuth(identifier, password) {
  if (!identifier || !password) {
    return { success: false, error: 'Please enter roll number / username and password.' };
  }
  const cleanId = String(identifier).trim();
  const sql = `SELECT row_to_json(t) FROM (SELECT * FROM public.passwords WHERE LOWER(TRIM(roll_number)) = LOWER(TRIM('${cleanId.replace(/'/g, "''")}'))) t;`;
  const res = queryPg(sql);
  if (!res || res === 'null') {
    // Exact requirement: "Else, it should get 'not found record' or 'first register', then you should go to admission register."
    return { success: false, error: 'Record not found. Please register first.' };
  }
  const userRow = JSON.parse(res);
  if (userRow.password !== String(password).trim()) {
    // Exact requirement: "If it's not matched, you should say wrong password"
    return { success: false, error: 'wrong password' };
  }
  return {
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
  };
}

export function signupAuth({ roll_number, password, student_name, department, phone_number, role, academic_year_at_start, incubation_start_date }) {
  if (!roll_number || !password || !student_name) {
    return { success: false, error: 'Roll number, student name, and password are required.' };
  }
  const cleanRoll = String(roll_number).trim().toUpperCase();
  const assignedRole = role || 'student';
  if (assignedRole === 'student' && cleanRoll.length !== 10) {
    return { success: false, error: 'Student roll number must be strictly 10 characters (e.g. 238W1A0477).' };
  }
  const startYear = academic_year_at_start ? Number(academic_year_at_start) : 1;
  const startDate = incubation_start_date || new Date().toISOString().slice(0, 10);
  const upsertSql = `
    INSERT INTO public.passwords (
      roll_number,
      password,
      student_name,
      role,
      department,
      phone_number,
      academic_year_at_start,
      incubation_start_date
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    ) ON CONFLICT (roll_number) DO UPDATE SET
      password = EXCLUDED.password,
      student_name = EXCLUDED.student_name,
      role = EXCLUDED.role,
      department = EXCLUDED.department,
      phone_number = EXCLUDED.phone_number,
      academic_year_at_start = COALESCE(EXCLUDED.academic_year_at_start, public.passwords.academic_year_at_start),
      incubation_start_date = COALESCE(EXCLUDED.incubation_start_date, public.passwords.incubation_start_date),
      updated_at = NOW()
    RETURNING roll_number, student_name, role, department, phone_number, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date;
  `;
  const result = queryPg(upsertSql, [
    cleanRoll,
    String(password).trim(),
    String(student_name).trim(),
    assignedRole,
    department || '',
    phone_number || '',
    startYear,
    startDate,
  ]);
  return {
    success: true,
    user: {
      id: cleanRoll,
      username: cleanRoll,
      rollNumber: assignedRole === 'student' ? cleanRoll : '',
      name: String(student_name).trim(),
      role: assignedRole,
      department: department || '',
      mobileNumber: phone_number || '',
      academicYearAtStart: startYear,
      incubationStartDate: startDate,
      retentionPeriodYears: 5 - startYear,
    },
    message: 'Account registered and saved into PostgreSQL passwords table with retention plan!',
  };
}

export function resetPasswordAuth(roll_number, new_password) {
  if (!roll_number || !new_password) {
    return { success: false, error: 'Roll number and new password are required.' };
  }
  const cleanRoll = String(roll_number).trim().toUpperCase();
  const sql = `
    UPDATE public.passwords
    SET password = $1, updated_at = NOW()
    WHERE LOWER(TRIM(roll_number)) = LOWER(TRIM($2))
    RETURNING id, roll_number, student_name, role;
  `;
  const res = queryPg(sql, [String(new_password).trim(), cleanRoll]);
  if (!res || res === 'null') {
    return { success: false, error: 'Record not found. Please register first.' };
  }
  return { success: true, message: 'Password updated successfully in PostgreSQL passwords table!' };
}

export function getPasswordsUsers() {
  const sql = `SELECT json_agg(t) FROM (SELECT id, roll_number, password, email, student_name, role, department, phone_number, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date, created_at, updated_at FROM public.passwords WHERE role = 'student' OR role IS NULL ORDER BY id ASC) t;`;
  const res = queryPg(sql);
  if (!res || res === 'null') return [];
  try {
    return JSON.parse(res);
  } catch {
    return [];
  }
}

export function getAllPasswordsAccounts() {
  const sql = `SELECT json_agg(t) FROM (SELECT id, roll_number, password, email, student_name, role, department, phone_number, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date, created_at, updated_at FROM public.passwords ORDER BY id ASC) t;`;
  const res = queryPg(sql);
  if (!res || res === 'null') return [];
  try {
    return JSON.parse(res);
  } catch {
    return [];
  }
}

const adminOtpStore = new Map();

export function requestAdminOtp(identifier) {
  if (!identifier) {
    return { success: false, error: 'Username or identifier is required.' };
  }
  const cleanId = String(identifier).trim().toLowerCase();

  // Strict User Rule: Only Primary Admin can recover password via Email OTP.
  // Sub-Admin and Students must have their password changed by the Admin.
  if (cleanId !== 'admin') {
    return {
      success: false,
      isRestrictedRole: true,
      error: 'Self-service OTP reset is strictly reserved for the Primary Administrator. Sub-Admins, Staff, and Students must contact the Administrator to change their password.',
    };
  }

  const sql = `SELECT row_to_json(t) FROM (SELECT * FROM public.passwords WHERE LOWER(TRIM(roll_number)) = 'admin') t;`;
  const res = queryPg(sql);
  if (!res || res === 'null') {
    return { success: false, error: 'Primary Administrator account not found in database.' };
  }
  const adminRow = JSON.parse(res);
  const targetEmail = adminRow.email ? String(adminRow.email).trim() : '';

  if (!targetEmail) {
    return {
      success: false,
      error: 'No Registered Email has been set for Administrator. Please log in and enter your Registered Email in the accounts table column first.',
    };
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

  adminOtpStore.set('admin', { otp, email: targetEmail, expiresAt });

  const parts = targetEmail.split('@');
  const userPart = parts[0] || 'admin';
  const domainPart = parts[1] || 'vrsec.ac.in';
  const maskedEmail = userPart.length > 2
    ? `${userPart.slice(0, 2)}***@${domainPart}`
    : `${userPart[0]}***@${domainPart}`;

  console.log(`[Admin OTP Service] Generated OTP for admin (${targetEmail}): ${otp}`);

  return {
    success: true,
    message: `A 6-digit OTP has been sent to your registered email (${maskedEmail}).`,
    email: targetEmail,
    maskedEmail,
    otpDemo: otp,
  };
}

export function verifyAdminOtpAndReset(identifier, otp, newPassword) {
  if (!identifier || !otp || !newPassword) {
    return { success: false, error: 'Identifier, OTP, and new password are required.' };
  }
  const cleanId = String(identifier).trim().toLowerCase();
  if (cleanId !== 'admin') {
    return { success: false, error: 'Self-service OTP reset is restricted to the Primary Administrator.' };
  }
  if (String(newPassword).trim().length < 6) {
    return { success: false, error: 'New password must be at least 6 characters long.' };
  }

  const record = adminOtpStore.get('admin');
  if (!record) {
    return { success: false, error: 'No active OTP request found. Please request an OTP first.' };
  }
  if (Date.now() > record.expiresAt) {
    adminOtpStore.delete('admin');
    return { success: false, error: 'OTP has expired. Please request a new OTP.' };
  }
  if (String(record.otp).trim() !== String(otp).trim()) {
    return { success: false, error: 'Incorrect OTP. Please check the code sent to your email.' };
  }

  const cleanPass = String(newPassword).trim();
  const sql = `
    UPDATE public.passwords
    SET password = $1, updated_at = NOW()
    WHERE LOWER(TRIM(roll_number)) = 'admin'
    RETURNING id, roll_number, student_name, role;
  `;
  const res = queryPg(sql, [cleanPass]);
  if (!res || res === 'null') {
    return { success: false, error: 'Failed to update admin password in database.' };
  }

  adminOtpStore.delete('admin');

  return {
    success: true,
    message: 'Admin password updated successfully! You can now log in with your new password.',
  };
}

export function updateAdminEmail(identifier, email) {
  if (!identifier || !email) {
    return { success: false, error: 'Identifier and email are required.' };
  }
  const cleanId = String(identifier).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();
  const sql = `
    UPDATE public.passwords
    SET email = $1, updated_at = NOW()
    WHERE LOWER(TRIM(roll_number)) = LOWER(TRIM($2))
    RETURNING id, roll_number, email;
  `;
  const res = queryPg(sql, [cleanEmail, cleanId]);
  if (!res || res === 'null') {
    return { success: false, error: 'Account not found in database.' };
  }
  return { success: true, message: 'Recovery email updated successfully in PostgreSQL database!' };
}

export function updatePasswordAccount({ roll_number, student_name, email, department, phone_number, academic_year_at_start, incubation_start_date }) {
  if (!roll_number) return { success: false, error: 'Account identifier is required.' };
  const cleanRoll = String(roll_number).trim();
  const startYear = academic_year_at_start ? Number(academic_year_at_start) : null;
  const startDate = incubation_start_date ? String(incubation_start_date).slice(0, 10) : null;
  const sql = `
    UPDATE public.passwords
    SET 
      student_name = COALESCE($1, student_name),
      email = $2,
      department = COALESCE($3, department),
      phone_number = COALESCE($4, phone_number),
      academic_year_at_start = COALESCE($5, academic_year_at_start),
      incubation_start_date = COALESCE($6, incubation_start_date),
      updated_at = NOW()
    WHERE LOWER(TRIM(roll_number)) = LOWER(TRIM($7))
    RETURNING id, roll_number, student_name, email, role, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date;
  `;
  const res = queryPg(sql, [
    student_name !== undefined ? (student_name ? String(student_name).trim() : null) : null,
    email !== undefined ? (email ? String(email).trim().toLowerCase() : '') : '',
    department !== undefined ? (department ? String(department).trim() : null) : null,
    phone_number !== undefined ? (phone_number ? String(phone_number).trim() : null) : null,
    startYear,
    startDate,
    cleanRoll
  ]);
  if (!res || res === 'null') {
    return { success: false, error: 'Account not found in database.' };
  }
  return { success: true, message: 'Account details and retention plan updated successfully!' };
}

/* =====================================================================
   2. ISSUED COMPONENTS & RETURNS
   ===================================================================== */

export function insertIssuedComponent({
  id,
  registration_number,
  student_name,
  phone_number,
  student_details,
  components,
  issue_date,
  overall_due_date,
  status,
  notes,
  issued_by,
}) {
  const sql = `
    INSERT INTO public.issued_components (
      id,
      registration_number,
      student_name,
      phone_number,
      student_details,
      components,
      issue_date,
      overall_due_date,
      status,
      notes,
      issued_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()), $8::timestamptz, COALESCE($9, 'issued'), $10, $11
    )
    ON CONFLICT (id) DO UPDATE SET
      registration_number = EXCLUDED.registration_number,
      student_name = EXCLUDED.student_name,
      phone_number = EXCLUDED.phone_number,
      student_details = EXCLUDED.student_details,
      components = EXCLUDED.components,
      overall_due_date = EXCLUDED.overall_due_date,
      status = EXCLUDED.status,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING id;
  `;

  return queryPg(sql, [
    id,
    registration_number,
    student_name,
    phone_number || null,
    student_details || {},
    components || [],
    issue_date || null,
    overall_due_date || null,
    status || 'issued',
    notes || null,
    issued_by || null,
  ]);
}

export function updateReturnComponent({ id, status, items }) {
  const sql = `
    UPDATE public.issued_components
    SET 
      status = $2,
      components = $3,
      updated_at = NOW()
    WHERE id = $1
    RETURNING id;
  `;
  return queryPg(sql, [
    id,
    status || 'returned',
    items || [],
  ]);
}

export function getIssuedComponents(registrationNumber = null) {
  let sql = `
    SELECT json_agg(t) FROM (
      SELECT 
        id,
        registration_number,
        student_name,
        phone_number,
        student_details,
        components,
        issue_date,
        overall_due_date,
        status,
        notes,
        issued_by,
        created_at
      FROM public.issued_components
  `;
  if (registrationNumber) {
    const clean = registrationNumber.replace(/'/g, "''");
    sql += ` WHERE UPPER(registration_number) = UPPER('${clean}')`;
  }
  sql += ` ORDER BY issue_date DESC ) t;`;
  const res = queryPg(sql);
  return res ? JSON.parse(res) : [];
}

/* =====================================================================
   3. POWER CONSUMPTION TABLE
   ===================================================================== */

export function savePowerConsumption(devices = []) {
  if (!Array.isArray(devices) || devices.length === 0) return 0;
  for (const d of devices) {
    const sql = `
      INSERT INTO public.power_consumption (
        device_id,
        device_name,
        device_type,
        location,
        actual_state,
        power_rating_watts,
        daily_kwh,
        weekly_kwh,
        monthly_kwh,
        yearly_kwh,
        estimated_monthly_cost,
        recorded_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      )
      ON CONFLICT (device_id) DO UPDATE SET
        device_name = EXCLUDED.device_name,
        device_type = EXCLUDED.device_type,
        location = EXCLUDED.location,
        actual_state = EXCLUDED.actual_state,
        power_rating_watts = EXCLUDED.power_rating_watts,
        daily_kwh = EXCLUDED.daily_kwh,
        weekly_kwh = EXCLUDED.weekly_kwh,
        monthly_kwh = EXCLUDED.monthly_kwh,
        yearly_kwh = EXCLUDED.yearly_kwh,
        estimated_monthly_cost = EXCLUDED.estimated_monthly_cost,
        recorded_at = NOW(),
        updated_at = NOW();
    `;
    queryPg(sql, [
      d.id,
      d.name || d.id,
      d.type || 'hardware',
      d.location || 'Incubation Lab',
      d.actualState || 'off',
      Number(d.powerRatingWatts) || 0,
      Number(d.dailyKwh) || 0,
      Number(d.weeklyKwh) || 0,
      Number(d.monthlyKwh) || 0,
      Number(d.yearlyKwh) || 0,
      Number(d.estimatedCostMonthly || d.estimatedMonthlyCostInr) || 0,
    ]);
  }
  return devices.length;
}

export function getPowerConsumption() {
  const sql = `
    SELECT json_agg(t) FROM (
      SELECT 
        id,
        device_id,
        device_name,
        device_type,
        location,
        actual_state,
        power_rating_watts,
        daily_kwh,
        weekly_kwh,
        monthly_kwh,
        yearly_kwh,
        estimated_monthly_cost,
        recorded_at,
        updated_at
      FROM public.power_consumption
      ORDER BY location ASC, device_name ASC
    ) t;
  `;
  const res = queryPg(sql);
  return res ? JSON.parse(res) : [];
}

/* =====================================================================
   4. OVERDUE TRACKER TABLE & CHECK OVERDUES WORKFLOW
   ===================================================================== */

export function checkAndSyncOverdues() {
  const txns = getIssuedComponents();
  const now = new Date();
  const overdueIdsFound = [];

  for (const txn of txns) {
    if (txn.status === 'returned') {
      queryPg(`UPDATE public.overdue_components SET status = 'returned', updated_at = NOW() WHERE transaction_id = $1;`, [txn.id]);
      continue;
    }

    const items = Array.isArray(txn.components) ? txn.components : [];

    for (const it of items) {
      const issuedQty = Number(it.issuedQuantity || it.quantity) || 1;
      const returnedQty = Number(it.returnedQuantity) || 0;
      const remaining = issuedQty - returnedQty;
      const ovdId = `OVD-${txn.id}-${it.componentId || it.id || 'ITEM'}`;

      if (remaining <= 0) {
        queryPg(`UPDATE public.overdue_components SET status = 'returned', updated_at = NOW() WHERE id = $1;`, [ovdId]);
        continue;
      }

      const itemDueDateStr = it.dueDate || txn.overall_due_date;
      if (!itemDueDateStr) continue;

      const dueDate = new Date(itemDueDateStr);
      if (dueDate < now) {
        const diffMs = now.getTime() - dueDate.getTime();
        const overdueDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        const severity = overdueDays > 7 ? 'critical' : 'moderate';

        const unreturnedTags = (it.individualIds || []).filter(
          (id) => !(it.returnedIndividualIds || []).includes(id)
        );

        const upsertSql = `
          INSERT INTO public.overdue_components (
            id,
            transaction_id,
            registration_number,
            student_name,
            phone_number,
            component_id,
            component_name,
            category,
            remaining_quantity,
            individual_ids,
            issue_date,
            due_date,
            overdue_days,
            severity,
            status,
            checked_at,
            updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz, $13, $14, 'overdue', NOW(), NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            remaining_quantity = EXCLUDED.remaining_quantity,
            individual_ids = EXCLUDED.individual_ids,
            overdue_days = EXCLUDED.overdue_days,
            severity = EXCLUDED.severity,
            status = 'overdue',
            checked_at = NOW(),
            updated_at = NOW();
        `;

        queryPg(upsertSql, [
          ovdId,
          txn.id,
          txn.registration_number,
          txn.student_name,
          txn.phone_number || '',
          it.componentId || it.id || 'ITEM',
          it.componentName || it.name || 'Component',
          it.category || 'General',
          remaining,
          unreturnedTags,
          txn.issue_date,
          dueDate.toISOString(),
          overdueDays,
          severity,
        ]);

        overdueIdsFound.push(ovdId);
      }
    }
  }

  return getOverdueComponents();
}

export function getOverdueComponents() {
  const sql = `
    SELECT json_agg(t) FROM (
      SELECT 
        id,
        transaction_id,
        registration_number,
        student_name,
        phone_number,
        component_id,
        component_name,
        category,
        remaining_quantity,
        individual_ids,
        issue_date,
        due_date,
        overdue_days,
        severity,
        status,
        checked_at
      FROM public.overdue_components
      WHERE status = 'overdue'
      ORDER BY overdue_days DESC, due_date ASC
    ) t;
  `;
  const res = queryPg(sql);
  return res ? JSON.parse(res) : [];
}

/* =====================================================================
   5. PROJECTS SHOWCASE SHARED REPOSITORY
   ===================================================================== */

export function createProject({
  id,
  title,
  description,
  domain,
  status = 'showcase',
  student_roll,
  student_name,
  team_members = [],
  tags = [],
  github_url = '',
  demo_url = '',
}) {
  const projId = id || `PROJ-${Date.now()}`;
  const sql = `
    INSERT INTO public.projects (
      id,
      title,
      description,
      domain,
      status,
      student_roll,
      student_name,
      team_members,
      tags,
      github_url,
      demo_url,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      domain = EXCLUDED.domain,
      status = EXCLUDED.status,
      team_members = EXCLUDED.team_members,
      tags = EXCLUDED.tags,
      github_url = EXCLUDED.github_url,
      demo_url = EXCLUDED.demo_url,
      updated_at = NOW()
    RETURNING id;
  `;
  queryPg(sql, [
    projId,
    title,
    description || '',
    domain || 'IoT & Embedded',
    status,
    student_roll,
    student_name,
    team_members,
    tags,
    github_url || null,
    demo_url || null,
  ]);
  return projId;
}

export function getProjects() {
  const sql = `
    SELECT json_agg(t) FROM (
      SELECT 
        id,
        title,
        description,
        domain,
        status,
        student_roll,
        student_name,
        team_members,
        tags,
        github_url,
        demo_url,
        created_at
      FROM public.projects
      ORDER BY created_at DESC
    ) t;
  `;
  const res = queryPg(sql);
  return res ? JSON.parse(res) : [];
}

/* =====================================================================
   6. RESEARCH PUBLICATIONS SHARED REPOSITORY
   ===================================================================== */

export function createResearchPublication({
  id,
  title,
  abstract,
  paper_type = 'Conference Paper',
  domain = 'Computer Science',
  journal_conference_name = '',
  student_roll,
  student_name,
  authors = [],
  doi = '',
  external_url = '',
  publication_date = null,
}) {
  const pubId = id || `PUB-${Date.now()}`;
  const sql = `
    INSERT INTO public.research_publications (
      id,
      title,
      abstract,
      paper_type,
      domain,
      journal_conference_name,
      student_roll,
      student_name,
      authors,
      doi,
      external_url,
      publication_date,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12::date, CURRENT_DATE), NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      abstract = EXCLUDED.abstract,
      paper_type = EXCLUDED.paper_type,
      domain = EXCLUDED.domain,
      journal_conference_name = EXCLUDED.journal_conference_name,
      authors = EXCLUDED.authors,
      doi = EXCLUDED.doi,
      external_url = EXCLUDED.external_url,
      updated_at = NOW()
    RETURNING id;
  `;
  queryPg(sql, [
    pubId,
    title,
    abstract || '',
    paper_type,
    domain,
    journal_conference_name || '',
    student_roll,
    student_name,
    authors,
    doi || null,
    external_url || null,
    publication_date || null,
  ]);
  return pubId;
}

export function getResearchPublications() {
  const sql = `
    SELECT json_agg(t) FROM (
      SELECT 
        id,
        title,
        abstract,
        paper_type,
        domain,
        journal_conference_name,
        student_roll,
        student_name,
        authors,
        doi,
        external_url,
        publication_date,
        created_at
      FROM public.research_publications
      ORDER BY created_at DESC
    ) t;
  `;
  const res = queryPg(sql);
  return res ? JSON.parse(res) : [];
}

/* =====================================================================
   6B. VISITOR ATTENDANCE (NON-REGISTERED / OCCASIONAL VISITORS)
   ===================================================================== */

export function recordVisitorEntry({
  full_name,
  visitor_type,
  organization_or_dept,
  phone_number,
  email,
  purpose_of_visit,
  host_or_accompanied_by,
  remarks,
}) {
  if (!full_name || !organization_or_dept || !purpose_of_visit) {
    return { success: false, error: 'Full name, organization/department, and purpose of visit are required.' };
  }
  const cleanName = String(full_name).trim();
  const cleanType = String(visitor_type || 'Visiting Faculty / Guest').trim();
  const cleanOrg = String(organization_or_dept).trim();
  const cleanPurpose = String(purpose_of_visit).trim();
  const visitorId = `VISITOR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}-${Math.floor(10 + Math.random() * 90)}`;

  const sql = `
    INSERT INTO public.visitor_attendance (
      visitor_id, full_name, visitor_type, organization_or_dept,
      phone_number, email, purpose_of_visit, host_or_accompanied_by,
      remarks, status, entry_time
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'inside', NOW())
    RETURNING id, visitor_id, full_name, visitor_type, organization_or_dept, phone_number, email, purpose_of_visit, host_or_accompanied_by, remarks, status, entry_time;
  `;

  queryPg(sql, [
    visitorId,
    cleanName,
    cleanType,
    cleanOrg,
    phone_number ? String(phone_number).trim() : '',
    email ? String(email).trim() : '',
    cleanPurpose,
    host_or_accompanied_by ? String(host_or_accompanied_by).trim() : '',
    remarks ? String(remarks).trim() : '',
  ]);

  return {
    success: true,
    visitor_id: visitorId,
    visitor: {
      visitor_id: visitorId,
      full_name: cleanName,
      visitor_type: cleanType,
      organization_or_dept: cleanOrg,
      purpose_of_visit: cleanPurpose,
      entry_time: new Date().toISOString(),
      status: 'inside',
    },
    message: `Visitor entry recorded for ${cleanName} (${cleanType})!`,
  };
}

export function recordVisitorExit(visitor_id) {
  if (!visitor_id) {
    return { success: false, error: 'Visitor ID is required.' };
  }
  const cleanId = String(visitor_id).trim();
  const sql = `
    UPDATE public.visitor_attendance
    SET 
      exit_time = NOW(),
      duration_minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - entry_time)) / 60)),
      status = 'completed',
      updated_at = NOW()
    WHERE (LOWER(TRIM(visitor_id)) = LOWER(TRIM($1)) OR id::text = $1)
      AND status = 'inside'
    RETURNING id, visitor_id, full_name, visitor_type, organization_or_dept, entry_time, exit_time, duration_minutes, status;
  `;
  const res = queryPg(sql, [cleanId]);
  if (!res || res === 'null') {
    return { success: false, error: `No active inside visit found for visitor ID "${cleanId}".` };
  }
  return {
    success: true,
    message: `Visitor exit recorded successfully.`,
  };
}

export function getActiveVisitors() {
  const sql = `
    SELECT json_agg(t) FROM (
      SELECT id, visitor_id, full_name, visitor_type, organization_or_dept,
             phone_number, email, purpose_of_visit, host_or_accompanied_by,
             entry_time, exit_time, duration_minutes, status, remarks, created_at
      FROM public.visitor_attendance
      WHERE status = 'inside'
      ORDER BY entry_time DESC
    ) t;
  `;
  const res = queryPg(sql);
  if (!res || res === 'null') return [];
  try {
    return JSON.parse(res);
  } catch {
    return [];
  }
}

export function getAllVisitorHistory(limit = 150) {
  const sql = `
    SELECT json_agg(t) FROM (
      SELECT id, visitor_id, full_name, visitor_type, organization_or_dept,
             phone_number, email, purpose_of_visit, host_or_accompanied_by,
             entry_time, exit_time, duration_minutes, status, remarks, created_at
      FROM public.visitor_attendance
      ORDER BY entry_time DESC
      LIMIT $1
    ) t;
  `;
  const res = queryPg(sql, [Number(limit) || 150]);
  if (!res || res === 'null') return [];
  try {
    return JSON.parse(res);
  } catch {
    return [];
  }
}

/* =====================================================================
   6C. RETENTION PLAN AUDIT & PRUNING (POSTGRESQL-NATIVE)
   ===================================================================== */

export function getRetentionAudit() {
  const sql = `
    SELECT json_agg(t) FROM (
      SELECT 
        p.id,
        p.roll_number,
        p.student_name,
        p.role,
        p.department,
        p.email,
        p.phone_number,
        COALESCE(p.academic_year_at_start, 1) as academic_year_at_start,
        COALESCE(p.retention_period_years, 5 - COALESCE(p.academic_year_at_start, 1)) as retention_period_years,
        p.incubation_start_date,
        p.retention_end_date,
        CASE 
          WHEN p.retention_end_date IS NOT NULL AND p.retention_end_date <= CURRENT_DATE THEN true
          ELSE false
        END as is_expired,
        COUNT(ic.id) as active_loans_count
      FROM public.passwords p
      LEFT JOIN public.issued_components ic ON LOWER(TRIM(ic.registration_number)) = LOWER(TRIM(p.roll_number)) AND ic.status IN ('issued', 'active')
      WHERE p.role = 'student' OR p.role IS NULL
      GROUP BY p.id, p.roll_number, p.student_name, p.role, p.department, p.email, p.phone_number, p.academic_year_at_start, p.retention_period_years, p.incubation_start_date, p.retention_end_date
      ORDER BY p.retention_end_date ASC NULLS LAST, p.roll_number ASC
    ) t;
  `;
  const res = queryPg(sql);
  if (!res || res === 'null') return { success: true, audit: [], stats: { total: 0, active: 0, expired: 0, eligible: 0, blocked: 0 } };
  try {
    const rows = JSON.parse(res) || [];
    let active = 0, expired = 0, eligible = 0, blocked = 0;
    const audit = rows.map((r) => {
      const isExpired = Boolean(r.is_expired);
      const hasActiveLoans = Number(r.active_loans_count || 0) > 0;
      let status = 'ACTIVE';
      let reason = `Retention plan active (${r.retention_period_years}y Plan) until ${r.retention_end_date || 'end of graduation'}.`;
      if (isExpired) {
        expired++;
        if (hasActiveLoans) {
          blocked++;
          status = 'EXPIRED_BLOCKED';
          reason = `Retention period expired on ${r.retention_end_date}, but student holds ${r.active_loans_count} active lab item(s).`;
        } else {
          eligible++;
          status = 'EXPIRED_ELIGIBLE';
          reason = `Retention period (${r.retention_period_years} years) expired on ${r.retention_end_date}. Clean sheet, eligible for pruning.`;
        }
      } else {
        active++;
      }
      return {
        ...r,
        status,
        reason,
        hasActiveLoans,
      };
    });
    return {
      success: true,
      audit,
      stats: { total: rows.length, active, expired, eligible, blocked },
    };
  } catch (err) {
    return { success: false, error: err.message, audit: [] };
  }
}

export function pruneExpiredRetentionStudents(approvedRolls = []) {
  if (!Array.isArray(approvedRolls) || approvedRolls.length === 0) {
    return { success: false, error: 'No student roll numbers provided for pruning.' };
  }
  const cleanRolls = approvedRolls.map((r) => String(r).trim().toUpperCase()).filter(Boolean);
  if (cleanRolls.length === 0) {
    return { success: false, error: 'Valid student roll numbers required.' };
  }
  let deletedCount = 0;
  for (const roll of cleanRolls) {
    const loanCheck = queryPg(`SELECT COUNT(*) FROM public.issued_components WHERE LOWER(TRIM(registration_number)) = LOWER(TRIM($1)) AND status IN ('issued', 'active');`, [roll]);
    if (Number(loanCheck || 0) > 0) {
      continue;
    }
    queryPg(`DELETE FROM public.passwords WHERE LOWER(TRIM(roll_number)) = LOWER(TRIM($1)) AND role = 'student';`, [roll]);
    deletedCount++;
  }
  return {
    success: true,
    deletedCount,
    message: `Successfully pruned ${deletedCount} student record(s) from PostgreSQL.`,
  };
}

/* =====================================================================
   7. UNIFIED HTTP REQUEST ROUTER
   ===================================================================== */

export async function handlePgApiRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // Health check
  if (pathname === '/api/pg/health') {
    try {
      const count = queryPg('SELECT COUNT(*) FROM public.issued_components;');
      const powerCount = queryPg('SELECT COUNT(*) FROM public.power_consumption;');
      const overdueCount = queryPg('SELECT COUNT(*) FROM public.overdue_components;');
      const passwordsCount = queryPg('SELECT COUNT(*) FROM public.passwords;');
      const projectsCount = queryPg('SELECT COUNT(*) FROM public.projects;');
      const publicationsCount = queryPg('SELECT COUNT(*) FROM public.research_publications;');
      res.statusCode = 200;
      return res.end(JSON.stringify({
        status: 'connected',
        issued_count: Number(count),
        power_devices_count: Number(powerCount),
        overdue_count: Number(overdueCount),
        passwords_count: Number(passwordsCount),
        projects_count: Number(projectsCount),
        publications_count: Number(publicationsCount),
      }));
    } catch (e) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ status: 'error', error: e.message }));
    }
  }

  // Authentication Login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { identifier, password } = JSON.parse(body || '{}');
        const authResult = loginAuth(identifier, password);
        res.statusCode = authResult.success ? 200 : 401;
        return res.end(JSON.stringify(authResult));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Authentication Signup (Student Registration / Account Creation)
  if (pathname === '/api/auth/signup' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const signupResult = signupAuth(payload);
        res.statusCode = signupResult.success ? 201 : 400;
        return res.end(JSON.stringify(signupResult));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Authentication Reset Password
  if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { roll_number, new_password } = JSON.parse(body || '{}');
        const resetResult = resetPasswordAuth(roll_number, new_password);
        res.statusCode = resetResult.success ? 200 : 400;
        return res.end(JSON.stringify(resetResult));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Admin Request OTP via Email
  if (pathname === '/api/auth/admin/request-otp' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { identifier, email } = JSON.parse(body || '{}');
        const otpResult = requestAdminOtp(identifier, email);
        res.statusCode = otpResult.success ? 200 : 400;
        return res.end(JSON.stringify(otpResult));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Admin Verify OTP & Reset Password
  if (pathname === '/api/auth/admin/verify-otp-reset' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { identifier, otp, new_password } = JSON.parse(body || '{}');
        const verifyResult = verifyAdminOtpAndReset(identifier, otp, new_password);
        res.statusCode = verifyResult.success ? 200 : 400;
        return res.end(JSON.stringify(verifyResult));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Admin Update Recovery Email
  if (pathname === '/api/auth/admin/update-email' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { identifier, email } = JSON.parse(body || '{}');
        const updateResult = updateAdminEmail(identifier, email);
        res.statusCode = updateResult.success ? 200 : 400;
        return res.end(JSON.stringify(updateResult));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Admin Update Account Details & Registered Email (for admin, subadmin, or student)
  if (pathname === '/api/auth/update-account' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const updateResult = updatePasswordAccount(payload);
        res.statusCode = updateResult.success ? 200 : 400;
        return res.end(JSON.stringify(updateResult));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // List all users from PostgreSQL passwords table (students)
  if (pathname === '/api/auth/users' && req.method === 'GET') {
    const users = getPasswordsUsers();
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: true, users }));
  }

  // List all accounts from PostgreSQL passwords table (including Admin and Sub-Admin)
  if (pathname === '/api/auth/all-accounts' && req.method === 'GET') {
    const accounts = getAllPasswordsAccounts();
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: true, accounts }));
  }

  // Projects Shared Repository (GET & POST)
  if (pathname === '/api/projects') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (!payload.title || !payload.student_roll) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Title and student_roll are required' }));
          }
          const projId = createProject(payload);
          res.statusCode = 201;
          return res.end(JSON.stringify({ success: true, id: projId, message: 'Project showcased in PostgreSQL shared repository!' }));
        } catch (err) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.method === 'GET') {
      try {
        const list = getProjects();
        res.statusCode = 200;
        return res.end(JSON.stringify({ data: list }));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message }));
      }
    }
  }

  // Research Publications Shared Repository (GET & POST)
  if (pathname === '/api/publications') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (!payload.title || !payload.student_roll) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Title and student_roll are required' }));
          }
          const pubId = createResearchPublication(payload);
          res.statusCode = 201;
          return res.end(JSON.stringify({ success: true, id: pubId, message: 'Research publication posted in PostgreSQL shared repository!' }));
        } catch (err) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.method === 'GET') {
      try {
        const list = getResearchPublications();
        res.statusCode = 200;
        return res.end(JSON.stringify({ data: list }));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message }));
      }
    }
  }

  // Issued Components POST & GET
  if (pathname === '/api/issued-components') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (!payload.id || !payload.registration_number || !payload.student_name) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Missing required fields: id, registration_number, student_name' }));
          }
          const resultId = insertIssuedComponent(payload);
          res.statusCode = 201;
          return res.end(JSON.stringify({ success: true, id: resultId, message: 'Saved to PostgreSQL successfully' }));
        } catch (err) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (req.method === 'GET') {
      try {
        const reg = url.searchParams.get('registration_number') || url.searchParams.get('student_roll');
        const rows = getIssuedComponents(reg);
        res.statusCode = 200;
        return res.end(JSON.stringify({ data: rows }));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message }));
      }
    }
  }

  // Return Components POST
  if (pathname === '/api/return-components') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (!payload.id) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Missing transaction id' }));
          }
          updateReturnComponent(payload);
          res.statusCode = 200;
          return res.end(JSON.stringify({ success: true, id: payload.id, message: 'Return status updated in PostgreSQL' }));
        } catch (err) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // Power Consumption Table GET & POST
  if (pathname === '/api/power-consumption') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const devices = Array.isArray(payload) ? payload : (payload.devices || []);
          const count = savePowerConsumption(devices);
          res.statusCode = 200;
          return res.end(JSON.stringify({ success: true, count, message: 'Power consumption records stored in PostgreSQL' }));
        } catch (err) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (req.method === 'GET') {
      try {
        const rows = getPowerConsumption();
        res.statusCode = 200;
        return res.end(JSON.stringify({ data: rows }));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message }));
      }
    }
  }

  // Overdue Tracker: Check Overdues POST
  if (pathname === '/api/check-overdues') {
    if (req.method === 'POST') {
      try {
        const overdueList = checkAndSyncOverdues();
        res.statusCode = 200;
        return res.end(JSON.stringify({
          success: true,
          count: overdueList.length,
          data: overdueList,
          message: `Checked overdues: ${overdueList.length} overdue record(s) stored in PostgreSQL`
        }));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message }));
      }
    }
  }

  // Overdue Components GET
  if (pathname === '/api/overdue-components') {
    if (req.method === 'GET') {
      try {
        const rows = getOverdueComponents();
        res.statusCode = 200;
        return res.end(JSON.stringify({ data: rows }));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message }));
      }
    }
  }

  // ==================== VISITOR ATTENDANCE ENDPOINTS ====================
  // Visitor Entry POST
  if (pathname === '/api/visitors/entry' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = recordVisitorEntry(payload);
        res.statusCode = result.success ? 201 : 400;
        return res.end(JSON.stringify(result));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Visitor Exit POST
  if (pathname === '/api/visitors/exit' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = recordVisitorExit(payload.visitor_id || payload.id);
        res.statusCode = result.success ? 200 : 400;
        return res.end(JSON.stringify(result));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Active Visitors currently inside GET
  if (pathname === '/api/visitors/active' && req.method === 'GET') {
    try {
      const visitors = getActiveVisitors();
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, visitors, count: visitors.length }));
    } catch (err) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // Visitor Attendance History GET
  if (pathname === '/api/visitors/history' && req.method === 'GET') {
    try {
      const limit = url.searchParams.get('limit') || 150;
      const history = getAllVisitorHistory(limit);
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, history, count: history.length }));
    } catch (err) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ==================== RETENTION PLAN ENDPOINTS ====================
  // Retention Audit GET
  if (pathname === '/api/retention/audit' && req.method === 'GET') {
    try {
      const auditResult = getRetentionAudit();
      res.statusCode = auditResult.success ? 200 : 500;
      return res.end(JSON.stringify(auditResult));
    } catch (err) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // Retention Prune POST
  if (pathname === '/api/retention/prune' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const pruneResult = pruneExpiredRetentionStudents(payload.rolls || payload.approvedRolls || []);
        res.statusCode = pruneResult.success ? 200 : 400;
        return res.end(JSON.stringify(pruneResult));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Not handled
  return false;
}
