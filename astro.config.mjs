// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    // Proxies wrangler bindings (D1, KV, etc.) into `astro dev` so the local
    // dev server sees the same `locals.runtime.env` as production.
    platformProxy: {
      enabled: true,
    },
  }),
});
