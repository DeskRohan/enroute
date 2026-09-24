import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.env': 'text/javascript',
  '.xml': 'application/xml',
  '.txt': 'text/plain'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  // Handle /api/ serverless routes
  if (pathname.startsWith('/api/')) {
    const apiName = pathname.replace('/api/', '').split('?')[0];
    const apiFilePath = path.join(__dirname, 'api', `${apiName}.js`);

    if (fs.existsSync(apiFilePath)) {
      try {
        const module = await import(`file://${apiFilePath}?t=${Date.now()}`);
        const handler = module.default;

        // Collect body if POST/PUT
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          let parsedBody = {};
          try {
            if (body) parsedBody = JSON.parse(body);
          } catch (_) {
            parsedBody = body;
          }

          const mockReq = {
            method: req.method,
            headers: req.headers,
            query: Object.fromEntries(parsedUrl.searchParams),
            body: parsedBody
          };

          const mockRes = {
            statusCode: 200,
            setHeader: (name, val) => res.setHeader(name, val),
            status(code) {
              this.statusCode = code;
              return this;
            },
            json(data) {
              res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(data));
            },
            end(data) {
              res.writeHead(this.statusCode);
              res.end(data);
            }
          };

          await handler(mockReq, mockRes);
        });
        return;
      } catch (err) {
        console.error('API Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
  }

  // Handle static files
  if (pathname === '/') pathname = '/index.html';
  if (!path.extname(pathname) && fs.existsSync(path.join(__dirname, `${pathname}.html`))) {
    pathname = `${pathname}.html`;
  }

  const filePath = path.join(__dirname, pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const fallbackPort = 3001;
    console.log(`Port ${PORT} is in use, falling back to port ${fallbackPort}...`);
    server.listen(fallbackPort, () => {
      console.log(`Enroute dev server running at http://localhost:${fallbackPort}`);
    });
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`Enroute dev server running at http://localhost:${PORT}`);
});

