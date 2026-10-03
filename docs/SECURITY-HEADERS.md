# Security headers for the web app

The admin panel keeps its sign-in tokens in the browser (see `TokenStorageService` for why). That makes one thing matter more than most:
if an attacker ever got a script to run in the page - through a bug in this app, or in a library it ships - it could read those tokens. A
**Content-Security-Policy** (CSP) is the browser-enforced backstop: it lets the page run only the scripts it shipped with.

## What ships

Production builds carry the policy in a `<meta http-equiv="Content-Security-Policy">` tag, so it travels with the build and needs no web
server configuration. `angular.json` points the `production` configuration at `src/index.prod.html`; `ng serve` and development builds use
`src/index.html`, which has no policy (the dev server needs inline scripts and a websocket back to itself).

| Directive | Value | Why |
|---|---|---|
| `default-src` | `'self'` | Anything not listed below may only come from this app's own origin. |
| `script-src` | `'self'` | **The one that matters.** Only the bundled scripts run: no inline scripts, no `eval`, no third-party script. |
| `style-src` | `'self' 'unsafe-inline'` | Angular injects each component's styles as `<style>` elements, and the module-flow diagrams add one too. Dropping `'unsafe-inline'` needs a per-response nonce (`ngCspNonce`), which a static host cannot produce. Styles cannot run code, so this is the acceptable trade. |
| `img-src` | `'self' data: blob: https:` | Uploaded media is served from wherever the platform's media storage points (the S3 bucket, a CDN, or this origin), which is a setting, not a build-time fact. `blob:` and `data:` are the upload previews. |
| `media-src` | `'self' blob: https:` | Same, for video previews. |
| `font-src` | `'self' data:` | Roboto and the Material icons are bundled; nothing is fetched from a font CDN. |
| `connect-src` | `'self'` | The API (`/api/v1`) and the notification hub (`/hubs/notifications`, a websocket) are same-origin behind the reverse proxy. A page that has been tampered with cannot send data to anyone else. |
| `object-src` | `'none'` | No plugins. |
| `base-uri` | `'self'` | An injected `<base>` tag cannot redirect every relative URL. |
| `form-action` | `'self'` | A form cannot be pointed at another site. |

### Why production builds no longer inline critical CSS

Angular's production build normally inlines the "critical" CSS and loads the rest with
`<link rel="stylesheet" media="print" onload="this.media='all'">`. That `onload` is an inline script, which `script-src 'self'` blocks - the
page would stay unstyled. `angular.json` therefore sets `optimization.styles.inlineCritical` to `false` for production; the stylesheet is a
plain `<link>`. The cost is one render-blocking CSS request.

## What a `<meta>` tag cannot do

Browsers ignore `frame-ancestors` (and `report-uri`, `sandbox`) in a meta tag. Send those, and the other standard headers, from the web server
that serves the app. nginx, for example:

```nginx
add_header Content-Security-Policy "frame-ancestors 'none'" always;   # nobody may frame the app (clickjacking)
add_header X-Frame-Options "DENY" always;                             # the same, for older browsers
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;   # only once HTTPS is final
```

A header policy and the meta policy both apply, and the browser enforces the intersection, so this adds to the meta tag and never loosens it.
(The API sets its own security headers; see `SecurityHeadersMiddleware` in the API repo.)

## Changing it

- **API or hub on a different origin** (anything other than `apiBaseUrl: '/api/v1'` behind the same host): add that origin to `connect-src`
  (`https://api.example.com wss://api.example.com`).
- **Media only ever comes from one CDN:** replace `https:` in `img-src` / `media-src` with that origin.
- **Trying a stricter policy safely:** have the web server send it as `Content-Security-Policy-Report-Only` first; violations are reported in the
  browser console without breaking anything.
- Edit the policy in **`src/index.prod.html` only** (inside the `csp:start` / `csp:end` block).

## Keeping it honest

`npm run check:csp` (and CI) verify that `index.prod.html` is identical to `index.html` apart from the policy block, that `script-src` has not
grown `'unsafe-inline'`, `'unsafe-eval'` or a wildcard, and - after a production build, `node scripts/check-csp.mjs --dist` - that the built
`index.html` contains no inline script or event handler, which would otherwise silently break the page.
