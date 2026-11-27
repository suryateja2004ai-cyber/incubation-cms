export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const envKeys = Object.keys(process.env).filter((k) =>
    /URL|DB|POSTGRES|NEON|SUPABASE/i.test(k)
  );

  return res.status(200).json({
    status: 'online',
    mode: 'cloud_browser_engine',
    version: '3.0-cloud-neon',
    message: 'Cloud Face Biometrics Service Online',
    envKeys,
  });
}
