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
    },
    plugins: [
      react(),
      mode === 'development' &&
      componentTagger(),
      // PostHog sourcemap upload disabled — re-enable when POSTHOG_PERSONAL_API_KEY is updated in Vercel
      // posthog({
      //   personalApiKey: env.POSTHOG_PERSONAL_API_KEY,
      //   projectId: env.POSTHOG_PROJECT_ID,
      //   host: 'https://eu.i.posthog.com',
      //   sourcemaps: {
      //     enabled: true,
      //     releaseName: 'hogflix',
      //     releaseVersion: `1.0.${Date.now()}`,
      //     deleteAfterUpload: true,
      //   },
      // }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
