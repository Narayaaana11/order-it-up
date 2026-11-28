import * as fs from 'node:fs';
import * as path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function resolveContainedFile(rootDir: string, reqPath: string): string | null {
  const normalizedRoot = path.resolve(rootDir);
  const decoded = decodeURIComponent(reqPath.split('?')[0]);
  const sanitized = decoded.replace(/^\/+/, '');

  const candidates = [
    path.resolve(normalizedRoot, sanitized),
    path.resolve(normalizedRoot, sanitized, 'index.html'),
    path.resolve(normalizedRoot, `${sanitized}.html`),
  ];

  for (const candidate of candidates) {
    if (
      candidate !== normalizedRoot &&
      !candidate.startsWith(normalizedRoot + path.sep)
    ) {
      continue;
    }
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

/**
 * Serves static web exports (desktop-ui/out or landing/out) with strict path containment.
 */
export function tryServeStaticFile(
  reqPath: string,
  staticDirs: string[]
): Response | null {
  for (const dir of staticDirs) {
    if (!dir || !fs.existsSync(dir)) continue;
    try {
      const filePath = resolveContainedFile(dir, reqPath);
      if (!filePath) continue;

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const isHashedAsset =
        reqPath.includes('/_next/static/') ||
        ['.js', '.css', '.woff2', '.png', '.svg', '.webp'].includes(ext);

      const bytes = fs.readFileSync(filePath);
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': isHashedAsset
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=60',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      continue;
    }
  }
  return null;
}
