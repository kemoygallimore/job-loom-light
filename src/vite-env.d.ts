/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_ENABLE_SENTRY_TEST_BUTTON?: string;
  readonly VITE_SENTRY_RELEASE?: string;
}
