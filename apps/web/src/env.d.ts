/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ICONS: R2Bucket;
    ICON_DEFAULT_WIDTH?: string;
  }
}

interface Env extends Cloudflare.Env {}
