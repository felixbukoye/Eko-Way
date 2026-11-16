import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Files the app shares with the design-system style guide live in the repo root
 * (design-system/*.css). Vite's root is app/, so those URLs would 404 or be
 * swallowed by the SPA fallback. This tiny middleware serves them directly.
 */
function serveRepoRoot() {
  const repoRoot = path.resolve(process.cwd());
  const allowed = ['/design-system/', '/styles/', '/tokens.json'];
  return {
    name: 'eko-way-serve-repo-root',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!allowed.some((prefix) => url.startsWith(prefix))) return next();
        const filePath = path.join(repoRoot, url);
        if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return next();
        }
        res.setHeader('Content-Type', url.endsWith('.css') ? 'text/css' : 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

/**
 * The app lives in app/. The design-system style guide stays at the repo root
 * (index.html) and is served separately, so Vite's root is app/.
 */
export default defineConfig({
  root: 'app',
  publicDir: 'public',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // The preview host is proxied, so allow any host header.
    allowedHosts: true,
    fs: { allow: ['..'] },
    // The design-system files live outside app/. Serve them from the repo root
    // (before Vite's own root handler) instead of relying on path traversal.
    proxy: {},
  },
  plugins: [react(), serveRepoRoot()],
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { outDir: '../dist', emptyOutDir: true },
});
