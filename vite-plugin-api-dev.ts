import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Dev-only bridge that serves the `api/*.ts` Vercel serverless functions from the Vite dev
 * server, so `npm run dev` behaves like production without needing the Vercel CLI.
 *
 * In production Vercel runs these same handler files directly (see vercel.json, which already
 * excludes /api from the SPA rewrite) — this plugin is never part of a build.
 *
 * The handlers read secrets from `process.env` (never `import.meta.env`), so the personal API
 * key stays in the Node process and is never exposed to the browser bundle.
 */

/** Server-side vars the api/ handlers need. Deliberately explicit — no blanket env passthrough. */
const SERVER_ENV_KEYS = [
  'POSTHOG_ENDPOINTS_API_KEY',
  'POSTHOG_PERSONAL_API_KEY',
  'POSTHOG_PROJECT_ID',
  'POSTHOG_HOST',
];

export function apiDevServer(env: Record<string, string>): Plugin {
  return {
    name: 'hogflix-api-dev-server',
    apply: 'serve',
    configureServer(server) {
      // Vite's loadEnv reads .env but doesn't populate process.env; the handlers expect it there.
      for (const key of SERVER_ENV_KEYS) {
        if (env[key] && !process.env[key]) process.env[key] = env[key];
      }

      const notFound = (res: ServerResponse) => {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Not found' }));
      };

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();

        // Only plain route names. Anything else (path traversal, the api/_lib helpers) 404s
        // rather than falling through to Vite's file serving — same as Vercel in production.
        const route = url.pathname.slice('/api/'.length);
        if (!/^[a-z0-9-]+$/i.test(route)) return notFound(res);

        try {
          const mod = await server.ssrLoadModule(`/api/${route}.ts`);
          const handler = mod.default;
          if (typeof handler !== 'function') return notFound(res);

          // Shim the bits of VercelRequest/VercelResponse the handlers actually use.
          const query: Record<string, string | string[]> = {};
          for (const key of new Set(url.searchParams.keys())) {
            const all = url.searchParams.getAll(key);
            query[key] = all.length > 1 ? all : all[0];
          }

          const vercelRes = Object.assign(res, {
            status(code: number) {
              res.statusCode = code;
              return vercelRes;
            },
            json(body: unknown) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(body));
              return vercelRes;
            },
          });

          await handler(Object.assign(req, { query }), vercelRes);
        } catch (err) {
          // No such route file → 404, like Vercel. Real failures return a JSON 500.
          if ((err as { code?: string })?.code === 'ERR_LOAD_URL') return notFound(res);
          server.config.logger.error(`[api-dev] /api/${route} failed: ${(err as Error).message}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: (err as Error).message }));
          }
        }
      });
    },
  };
}
