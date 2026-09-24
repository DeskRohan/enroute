export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let key = req.query.key || (req.body && req.body.key) || process.env.SHAREMODS_API_KEY;

    if (!key) {
      return res.status(400).json({ error: 'ShareMods API key is required' });
    }

    // Extract key if a full URL was passed
    if (key.includes('key=')) {
      const match = key.match(/key=([a-zA-Z0-9]+)/);
      if (match) key = match[1];
    }

    const response = await fetch(`https://sharemods.com/api/upload/server?key=${encodeURIComponent(key)}`);
    const data = await response.json();

    if (!response.ok || data.status !== 200) {
      return res.status(data.status || 500).json({
        error: data.msg || 'Failed to fetch upload server from ShareMods',
        details: data
      });
    }

    return res.status(200).json({
      uploadServerUrl: data.result,
      sessId: data.sess_id,
      msg: data.msg
    });
  } catch (error) {
    console.error('Error fetching ShareMods upload server:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
