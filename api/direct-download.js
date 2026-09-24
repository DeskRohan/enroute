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

    // If it's already a direct binary file URL (e.g., direct CDN or zip link)
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

    const pageUrl = `https://sharemods.com/${fileCode}`;
    const postBody = new URLSearchParams({
      op: 'download2',
      id: fileCode,
      rand: '',
      referer: pageUrl,
      method_free: '',
      method_premium: ''
    });

    const response = await fetch(pageUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': pageUrl
      },
      body: postBody.toString()
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Storage server responded with status ${response.status}`,
        fallbackUrl: pageUrl
      });
    }

    const html = await response.text();

    // Match the primary download button generated on the second page
    const btnMatch = html.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*btn[^"']*["'][^>]*>\s*Download/i)
                  || html.match(/<a\s+[^>]*class=["'][^"']*btn[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>\s*Download/i)
                  || html.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>[^<]*Download\s*\[/i)
                  || html.match(/href=["'](https?:\/\/[^"']*(?:r2\.cloudflarestorage\.com|sharedd\.)[^"']*)["']/i);

    if (!btnMatch) {
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
    return res.status(500).json({
      error: error.message || 'Internal server error resolving download',
      fallbackUrl: req.query.url || ''
    });
  }
}
