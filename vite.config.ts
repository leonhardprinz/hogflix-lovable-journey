import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import posthog from "@posthog/rollup-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        '/ingest': {
          target: 'https://eu.i.posthog.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ingest/, ''),
        },
      },
    },
    plugins: [
      react(),
      mode === 'development' &&
      componentTagger(),
      // PostHog sourcemap upload — explicit opt-in via POSTHOG_SOURCEMAPS_ENABLED=true.
      // Default off so an invalid / expired personal API key never blocks a deploy.
      // Re-enable once the key is fresh:
      //   1) generate a fresh personal API key with "sourcemap upload" scope
      //   2) set POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID + POSTHOG_SOURCEMAPS_ENABLED=true
      //      on Vercel (and locally in .env)
      mode === 'production' &&
        env.POSTHOG_SOURCEMAPS_ENABLED === 'true' &&
        env.POSTHOG_PERSONAL_API_KEY &&
        env.POSTHOG_PROJECT_ID &&
        posthog({
          personalApiKey: env.POSTHOG_PERSONAL_API_KEY,
          projectId: env.POSTHOG_PROJECT_ID,
          host: 'https://eu.i.posthog.com',
          sourcemaps: {
            enabled: true,
            releaseName: 'hogflix',
            releaseVersion: `1.0.${Date.now()}`,
            deleteAfterUpload: true,
          },
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
