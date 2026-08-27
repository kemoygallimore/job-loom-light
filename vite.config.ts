import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN ?? env.SENTRY_AUTH_TOKEN;
  const sentryOrg = process.env.SENTRY_ORG ?? env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT ?? env.SENTRY_PROJECT;
  const enableSentrySourceMaps = mode === "production"
    && Boolean(sentryAuthToken)
    && Boolean(sentryOrg)
    && Boolean(sentryProject);

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    build: {
      sourcemap: enableSentrySourceMaps ? "hidden" : false,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      enableSentrySourceMaps
        && sentryVitePlugin({
          org: sentryOrg,
          project: sentryProject,
          authToken: sentryAuthToken,
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@/integrations/supabase/client": path.resolve(__dirname, "./src/integrations/supabase/externalClient.ts"),
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
