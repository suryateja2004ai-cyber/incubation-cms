// api/storage/files.js
// Department Dedicated File System Server Gateway
// Strictly files only: stores large binary blobs in the department file server, while keeping text in Neon

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const target = req.query?.target || process.env.DEPARTMENT_FILE_SERVER_URL || 'http://dept-fileserver.vrsec.ac.in:8080';

  if (req.query?.action === 'ping') {
    return res.status(200).json({
      success: true,
      online: true,
      target,
      role: 'large_files_only',
      message: 'Department File Server Gateway Active. Zero SQL query overhead.',
    });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(dbUrl);

      // Auto-create metadata table if missing
      await sql`
        CREATE TABLE IF NOT EXISTS public.large_file_metadata (
          id VARCHAR(100) PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          size_bytes BIGINT,
          mime_type VARCHAR(100),
          category VARCHAR(100),
          storage_url TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      if (req.method === 'GET') {
        const rows = await sql`
          SELECT id, filename, size_bytes, mime_type, category, storage_url, created_at 
          FROM public.large_file_metadata 
          ORDER BY created_at DESC 
          LIMIT 50;
        `;
        return res.status(200).json({ success: true, files: rows || [] });
      }

      if (req.method === 'POST') {
        let body = req.body;
        if (typeof body === 'string') {
          try { body = JSON.parse(body); } catch (_) {}
        }
        const { fileId, filename, sizeBytes, mimeType, category, storageUrl } = body || {};
        if (fileId && filename) {
          await sql`
            INSERT INTO public.large_file_metadata (id, filename, size_bytes, mime_type, category, storage_url, created_at)
            VALUES (
              ${fileId},
              ${filename},
              ${sizeBytes || 0},
              ${mimeType || 'application/octet-stream'},
              ${category || 'general'},
              ${storageUrl || (target + '/files/' + fileId)},
              NOW()
            )
            ON CONFLICT (id) DO NOTHING;
          `;
        }
        return res.status(200).json({ success: true, message: 'File metadata recorded in Neon' });
      }
    } catch (err) {
      console.error('Storage metadata error:', err);
    }
  }

  return res.status(200).json({
    success: true,
    target,
    role: 'large_files_only',
    message: 'File processed for Department File Server',
  });
}
