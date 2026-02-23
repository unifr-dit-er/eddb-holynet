import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const rootDir = 'dist';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const safePath = (urlPath) => {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const normalizedPath = normalize(decodedPath).replace(/^\/+/, '');
  const candidate = join(rootDir, normalizedPath);

  if (!candidate.startsWith(rootDir)) {
    return null;
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  return join(rootDir, 'index.html');
};

const server = createServer((req, res) => {
  const requestPath = req.url || '/';
  const filePath = safePath(requestPath === '/' ? '/index.html' : requestPath);

  if (!filePath || !existsSync(filePath)) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  const extension = extname(filePath).toLowerCase();
  const contentType = contentTypes[extension] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Static server running at http://${host}:${port}`);
});
