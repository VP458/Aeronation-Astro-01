/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

// Regenerate with `npm run cf-typegen` after changing wrangler.jsonc bindings.
type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
};

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
