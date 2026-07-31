# DNS Cutover: icons.kage1020.com to Cloudflare Pages

Procedure to switch `icons.kage1020.com` from its previous origin to the new Cloudflare Pages deployment.

## Prerequisites

- Cloudflare Pages project `icon-collection-web` deployed on `icon-collection-web.pages.dev` (verify: `curl -I https://icon-collection-web.pages.dev/`)
- DNS authority for `kage1020.com` is on Cloudflare
- Previous origin is accessible as a rollback fallback for 30 days

## Cutover steps

1. **Update CNAME record**
   - Cloudflare dashboard → Zone `kage1020.com` → DNS
   - Find the `icons` subdomain record (type CNAME)
   - Change target to `icon-collection-web.pages.dev`
   - Set TTL to 300 (5 minutes) for faster rollback if needed

2. **Verify API is responding**
   ```bash
   curl -I "https://icons.kage1020.com/api/search?q=home"
   ```
   Should return `200 OK`

3. **Verify legacy redirect**
   ```bash
   curl -I "https://icons.kage1020.com/mdi/home.svg"
   ```
   Should return `301 Moved Permanently` with `Location: /icon/mdi/home.svg`

4. **Monitor propagation**
   - Wait 5–10 minutes for DNS propagation
   - Check from multiple locations: `nslookup icons.kage1020.com`
   - Verify CDN cache is warm (optional: purge Cloudflare cache if needed)

5. **Archive previous origin**
   - Once stable, keep the previous origin (S3/GitHub Pages/etc.) for 30 days as a rollback fallback
   - After 30 days, archive or decommission it

## Rollback

If issues occur:

1. **Revert DNS CNAME** back to the previous origin
2. **Wait 5 minutes** for propagation
3. No other changes needed—traffic returns to the old endpoint

Rollback is instantaneous from the DNS perspective; no code deployment needed.
