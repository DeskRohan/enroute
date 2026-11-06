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
    const DEFAULT_KEY = "184356pw7b4tb78jfy6i0h01sw1675aegj2xty";
    let key = req.query.key || (req.body && req.body.key) || process.env.SHAREMODS_API_KEY || DEFAULT_KEY;

    if (!key) {
      return res.status(400).json({ error: 'ShareMods API key is required' });
    }

    // Extract key if a full URL was passed
    if (key.includes('key=')) {
      const match = key.match(/key=([a-zA-Z0-9]+)/);
      if (match) key = match[1];
    }

    const response = await fetch(`https://sharemods.com/api/upload/server?key=${encodeURIComponent(key)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    const responseText = await response.text();
    let data = {};
    try {
      data = JSON.parse(responseText);
    } catch (_) {
      const match = responseText.match(/https?:\/\/[^\s"'<>]+\/cgi-bin\/upload\.cgi/);
      if (match) {
        data = { status: 200, result: match[0] };
      }
    }

    if (!response.ok || (data.status && data.status !== 200)) {
      return res.status(data.status || 500).json({
        error: data.msg || 'Failed to fetch upload server from ShareMods',
        details: data,
        raw: responseText.slice(0, 200)
      });
    }

    return res.status(200).json({
      uploadServerUrl: data.result || 'https://bio7.sharemods.com/cgi-bin/upload.cgi',
      sessId: data.sess_id || '',
      msg: data.msg || 'OK'
    });
  } catch (error) {
    console.error('Error fetching ShareMods upload server:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
