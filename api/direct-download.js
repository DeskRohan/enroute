// In-memory cache for resolved direct download links (50 min TTL)
const linkCache = new Map();

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const rawTarget = req.query.url || req.query.fileCode || req.query.code || (req.body && (req.body.url || req.body.fileCode || req.body.code));
    const shouldRedirect = req.query.download === '1' || req.query.redirect === 'true';

    if (!rawTarget) {
      return res.status(400).json({ error: 'Missing "url" or "fileCode" parameter' });
    }

    const target = rawTarget.trim();

    // If it's already a direct binary file URL (e.g. presigned R2/S3 or zip)
    if (target.includes('.r2.cloudflarestorage.com') || target.includes('/dl.cgi/') || target.endsWith('.zip') || target.endsWith('.bussidmod')) {
      if (shouldRedirect) {
        res.setHeader('Location', target);
        return res.status(302).end();
      }
      return res.status(200).json({ ok: true, directUrl: target });
    }

    // Extract fileCode from ShareMods URL or code string
    let fileCode = target;
    const match = target.match(/sharemods\.com\/([a-zA-Z0-9]+)/);
    if (match) {
      fileCode = match[1];
    } else {
      const codeMatch = target.match(/^[a-zA-Z0-9]{8,20}$/);
      if (codeMatch) {
        fileCode = codeMatch[0];
      }
    }

    // Check memory cache first (instant 0ms response)
    const cached = linkCache.get(fileCode);
    if (cached && (Date.now() - cached.timestamp < 50 * 60 * 1000)) {
      if (shouldRedirect) {
        res.setHeader('Location', cached.directUrl);
        return res.status(302).end();
      }
      return res.status(200).json({
        ok: true,
        directUrl: cached.directUrl,
        filename: cached.filename,
        fileCode,
        cached: true
      });
    }

    // 1. Check official ShareMods API direct_link using provided API key
    const apiKey = process.env.SHAREMODS_API_KEY || '184356pw7b4tb78jfy6i0h01sw1675aegj2xty';
    try {
      const apiRes = await fetch(`https://sharemods.com/api/file/direct_link?key=${apiKey}&file_code=${fileCode}`);
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        const directUrl = apiData.result?.url || apiData.result?.direct_link || (typeof apiData.result === 'string' && apiData.result.startsWith('http') ? apiData.result : null);
        if (directUrl) {
          linkCache.set(fileCode, { directUrl, filename: '', timestamp: Date.now() });
          if (shouldRedirect) {
            res.setHeader('Location', directUrl);
            return res.status(302).end();
          }
          return res.status(200).json({ ok: true, directUrl, fileCode });
        }
      }
    } catch (_) {}

    // 2. Resolve via automated 2-step session with cookie tracking
    const pageUrl = `https://sharemods.com/${fileCode}`;
    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    // Step A: GET page to acquire session affiliate & anti-bot cookies
    const getRes = await fetch(pageUrl, { headers: commonHeaders });
    const cookies = [];
    const setCookie = getRes.headers.get('set-cookie');
    if (setCookie) {
      setCookie.split(',').forEach(c => {
        const part = c.split(';')[0].trim();
        if (part) cookies.push(part);
      });
    }

    let op = 'download2';
    let id = fileCode;
    let rand = '';

    if (getRes.ok) {
      const getHtml = await getRes.text();
      const opMatch = getHtml.match(/name="op"\s+value="([^"]+)"/i);
      const idMatch = getHtml.match(/name="id"\s+value="([^"]+)"/i);
      const randMatch = getHtml.match(/name="rand"\s+value="([^"]+)"/i);
      if (opMatch) op = opMatch[1];
      if (idMatch) id = idMatch[1];
      if (randMatch) rand = randMatch[1];
    }

    // Step B: POST download form with session cookies
    const postBody = new URLSearchParams({
      op,
      id,
      rand,
      referer: pageUrl,
      method_free: '',
      method_premium: ''
    });

    const postHeaders = {
      ...commonHeaders,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': pageUrl,
      'Origin': 'https://sharemods.com'
    };
    if (cookies.length > 0) {
      postHeaders['Cookie'] = cookies.join('; ');
    }

    const response = await fetch(pageUrl, {
      method: 'POST',
      headers: postHeaders,
      body: postBody.toString()
    });

    if (!response.ok) {
      if (shouldRedirect) {
        res.setHeader('Location', pageUrl);
        return res.status(302).end();
      }
      return res.status(response.status).json({
        error: `Storage server responded with status ${response.status}`,
        fallbackUrl: pageUrl
      });
    }

    const html = await response.text();

    // Match the primary download button generated on the second page
    const btnMatch = html.match(/href=["'](https?:\/\/[^"']*(?:r2\.cloudflarestorage\.com|sharedd\.)[^"']*)["']/i)
                  || html.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*btn[^"']*["'][^>]*>\s*Download/i)
                  || html.match(/<a\s+[^>]*class=["'][^"']*btn[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>\s*Download/i)
                  || html.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>[^<]*Download\s*\[/i);

    if (!btnMatch) {
      if (shouldRedirect) {
        res.setHeader('Location', pageUrl);
        return res.status(302).end();
      }
      return res.status(404).json({
        error: 'Direct download link could not be resolved from storage provider',
        fallbackUrl: pageUrl
      });
    }

    const directUrl = btnMatch[1].replace(/&amp;/g, '&');

    // Extract filename if present
    let filename = '';
    const fnMatch = directUrl.match(/filename%3D%22([^%"]+)%22/) 
                 || directUrl.match(/filename=["']?([^"';&]+)/);
    if (fnMatch) {
      try {
        filename = decodeURIComponent(fnMatch[1]);
      } catch (_) {
        filename = fnMatch[1];
      }
    } else {
      try {
        const u = new URL(directUrl);
        const lastPart = u.pathname.split('/').filter(Boolean).pop();
        if (lastPart && (lastPart.endsWith('.zip') || lastPart.endsWith('.rar') || lastPart.endsWith('.7z') || lastPart.endsWith('.bussidmod'))) {
          filename = decodeURIComponent(lastPart);
        }
      } catch (_) {}
    }

    // Save to memory cache for fast repeat downloads
    linkCache.set(fileCode, { directUrl, filename, timestamp: Date.now() });

    if (shouldRedirect) {
      res.setHeader('Location', directUrl);
      return res.status(302).end();
    }

    return res.status(200).json({
      ok: true,
      directUrl,
      filename,
      fileCode
    });

  } catch (error) {
    console.error('Direct download resolution error:', error);
    if (req.query.download === '1' || req.query.redirect === 'true') {
      const fallback = (req.query.url && req.query.url.startsWith('http')) ? req.query.url : 'https://sharemods.com';
      res.setHeader('Location', fallback);
      return res.status(302).end();
    }
    return res.status(500).json({
      error: error.message || 'Internal server error resolving download',
      fallbackUrl: req.query.url || ''
    });
  }
}
