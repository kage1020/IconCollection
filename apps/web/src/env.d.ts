/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ICONS: R2Bucket;
  }
}

interface Env extends Cloudflare.Env {}
