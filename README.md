# WhatsApp Sales Automation — Admin Panel (Angular)

Angular 15 admin panel for the WhatsApp Marketing + AI Sales Automation platform. This
repo covers the **Phase 2** frontend: authentication, users & roles, and customer
management — the UI counterpart to the endpoints in
[docs/PHASE2-BACKEND-SETUP.md](docs/PHASE2-BACKEND-SETUP.md).

Phases 3–6 (campaigns, media library, agent inbox, knowledge base, leads/CRM, reports)
are deliberately absent: their APIs do not exist yet.

---

## 1. Status

Verified working:

- `npm install` — clean
- `npm run build` — succeeds in both development and production configurations
- `npm test` — 12 specs, all passing (ChromeHeadless)
- `npm start` — serves at `http://localhost:4200`, login screen renders, and
  `/api/v1/*` proxies to the backend (an unauthenticated call returns 401 from the API,
  same as calling it directly)
- API contract — every request and response shape checked against
  `/swagger/v1/swagger.json` on the running backend (see §6)

Not verified: **the authenticated screens have never been exercised against real data.**
Customers, users/roles and the CSV import have only been checked for compile-correctness
and contract match, not by signing in and clicking through. Sign in and try them.

## 2. Prerequisites

- Node.js `^14.20 || ^16.13 || ^18.10` (Angular 15's supported range; 18.x LTS is the
  safe pick)
- npm 8+
- The Phase 2 .NET API running locally

## 3. Getting started

```bash
npm install
```

Point the dev proxy at your API. `dotnet run` prints the HTTPS port it bound; put it in
[proxy.conf.json](proxy.conf.json) — currently set to `https://localhost:59205`:

```json
{
  "/api": {
    "target": "https://localhost:59205",
    "secure": false,
    "changeOrigin": true
  }
}
```

`"secure": false` accepts the ASP.NET Core dev certificate. Then:

```bash
npm start
```

The app serves at `http://localhost:4200` and proxies `/api/*` to the backend, so there
is no CORS configuration to do in development.

Sign in with the seeded Super Admin from the backend's `appsettings.Development.json`
(`admin@example.com` / `ChangeMe123!` by default).

### Other commands

```bash
npm run build
```

```bash
npm test
```

## 4. What's implemented

| Area | Screens | API endpoints used |
|---|---|---|
| Auth | Login, change password | `POST /auth/login`, `/auth/refresh-token`, `/auth/logout`, `/auth/change-password` |
| Shell | Sidenav + toolbar, account menu, role-aware nav | — |
| Dashboard | Customer counts by opt-in status | `GET /customers` (count via `totalCount`) |
| Customers | Paged/searchable list, detail, create/edit dialog, tagging, opt-in/opt-out, multi-select bulk delete, CSV/Excel import with progress and a per-row error report | `GET/POST /customers`, `GET/PUT/DELETE /customers/{id}`, `POST /customers/{id}/tags`, `POST /customers/{id}/opt-in`, `POST /customers/{id}/opt-out`, `POST /customers/bulk-delete`, `POST /customers/import` |
| Tags | Paged/searchable list, create, rename, delete (with a force-delete path when a tag is still applied to customers) | `GET/POST /tags`, `GET/PUT/DELETE /tags/{id}` |
| Users & roles | Paged list, create/edit dialog, role assignment dialog | `GET/POST /users`, `GET/PUT/DELETE /users/{id}`, `PUT /users/{id}/roles`, `GET /roles` |

### Auth behaviour

- Access + refresh tokens are stored in `localStorage` by
  [TokenStorageService](src/app/core/services/token-storage.service.ts).
- [AuthInterceptor](src/app/core/interceptors/auth.interceptor.ts) attaches the bearer
  token, and on a 401 rotates the pair once and replays the request.
  `AuthService.refreshAccessToken()` shares one in-flight refresh, so a burst of parallel
  401s triggers a single refresh call. If the refresh fails, the session is cleared and
  the user lands on `/login` with a `returnUrl`.
- [ErrorInterceptor](src/app/core/interceptors/error.interceptor.ts) turns
  `ProblemDetails` and FluentValidation error dictionaries into one readable toast, then
  rethrows.
- Route guards (`authGuard`, `roleGuard`, `guestGuard`) and the `*appHasRole` directive
  shape the UI only. **The API is the sole authority on authorization** — hiding a link
  is not access control.

## 5. Project structure

```
src/app/
  core/          singleton services, models, guards, HTTP interceptors (imported once, by AppModule)
    guards/      authGuard, roleGuard, guestGuard (functional guards)
    interceptors/auth.interceptor.ts, error.interceptor.ts
    models/      API contract types
    services/    auth, token storage, customer, user, notification
  shared/        SharedModule — Material re-exports, confirm dialog, page header, hasRole directive
  layout/        app shell (sidenav + toolbar)
  features/      lazy-loaded route modules: auth, account, dashboard, customers, users
```

Every feature is lazy-loaded from [app-routing.module.ts](src/app/app-routing.module.ts).
Path aliases `@core/*`, `@shared/*` and `@env/*` are configured in `tsconfig.json`.

## 6. API contract

Verified against `/swagger/v1/swagger.json` on the running backend. The models in
`src/app/core/models/` mirror it exactly.

- **Paged responses** are `{ items, totalCount, page, pageSize, totalPages }` — the field
  is `page`, not `pageNumber`.
- **Paged queries** bind **PascalCase** `Page`, `PageSize`, `Search` (see `toPagedParams`).
  There is **no sorting and no filtering** beyond free-text search.
- **`TokenPairDto`** returns `accessToken`, `accessTokenExpiresAtUtc`, `refreshToken`,
  `refreshTokenExpiresAtUtc`, `user`.
- **`optInStatus` is a string** on the wire, so the enum values only affect the status
  chip's colour, never whether the value displays.
- **`GET /roles`** returns a plain `string[]`, not objects.
- **Import** posts multipart under the field name `file` and responds synchronously with
  `{ totalRows, importedCount, skippedDuplicateCount, failedCount, rowErrors[] }`. Each
  row error is `{ rowNumber, reason }`. There is no background-job status endpoint.

These API behaviours shaped the UI, and are worth knowing before you extend it:

1. **Phone numbers are normalized server-side, not required in E.164.** Separators are
   stripped, `00` is the international prefix, and a number with no country code is assumed
   Indian (`+91`). [`core/utils/phone-number.ts`](src/app/core/utils/phone-number.ts)
   mirrors the backend's `PhoneNumberNormalizer` so the form accepts exactly what the API
   accepts, and previews the E.164 form the number will be stored as. Its spec exists to
   fail if the server's rules drift.
2. **The phone number is editable** and required on update. The API returns **409** if it
   already belongs to another customer — including a soft-deleted one, which still holds
   the number in the unique index.
3. **`CreateCustomerRequest` does not accept tags.** The dialog creates the customer, then
   calls `POST /customers/{id}/tags` in a second request.
4. **Tags can only be added, never removed** — there is no delete-tag endpoint. Existing
   tags render as read-only chips; only tags staged in the current dialog can be removed.
5. **Opt-in requires a consent source.** `POST /customers/{id}/opt-in` takes
   `{ source, capturedAt? }`; `source` is mandatory because consent with no provenance is
   not evidence, and `capturedAt` may not be in the future. It is idempotent — re-recording
   opt-in never overwrites the original consent timestamp. **Opt-out**, by contrast, takes
   no body, so no reason is captured.
6. **`CreateUserRequest` has no `isActive`** (new users are active) and
   **`UpdateUserRequest` has no `email`** (immutable). Both fields are hidden or disabled
   in the mode where the API ignores them.
7. **The customer list cannot filter by opt-in status**, which is why the dashboard shows
   totals only — a per-status breakdown would show the same number in every tile.
8. **Bulk delete** (`POST /customers/bulk-delete`) is one request capped at 500 ids, and is
   idempotent: already-deleted ids come back in `notFoundIds` rather than failing the call,
   so the UI reports what actually happened instead of assuming.
9. **Tags are now their own resource** (`/tags`, full CRUD) rather than only reachable
   through a customer, with `TagDto.customerCount` on every row. Deleting a tag still
   applied to customers returns **409** unless `?force=true` is passed. The list already
   has the count, so [`TagListComponent.delete`](src/app/features/tags/tag-list/tag-list.component.ts)
   uses it to decide up front whether to force — it does not force blindly, so a tag that
   became in-use since the page loaded still 409s with the real count via
   `ErrorInterceptor`, rather than silently detaching it from customers nobody saw listed.
   Tag names disallow `,` and `;` (the import file's separators) — mirrored client-side in
   [`tagNameValidator`](src/app/core/utils/tag-name.validator.ts).

One thing swagger does not state: whether `Page` is 1-based. The code assumes it is (and
converts for Material's 0-based paginator). If the first page comes back empty, that
assumption is where to look.

## 7. Known gaps

- **No forgot/reset password.** The Phase 2 API has no such endpoint; the login screen
  says so rather than offering a dead link.
- **No admin password reset.** Editing a user cannot change their password.
- **Tokens in `localStorage`** are XSS-exposed. The alternative — an HttpOnly refresh
  cookie — needs backend support the current API does not provide.
- **No test coverage beyond two service specs** (`TokenStorageService`,
  `CustomerService`). Component tests are thin, matching the backend's own deferral of
  test projects to Phase 6.
- **No column sorting**, because the list endpoints accept no sort parameter. Sortable
  headers that silently did nothing would be worse than none.
- **Fonts are self-hosted** (`@fontsource/roboto`, `@fontsource/material-icons`) rather
  than loaded from Google's CDN, so the panel works offline and makes no third-party
  request. Note that `@fontsource` ships only `@font-face` rules — `styles.scss` defines
  the `.material-icons` class itself, which is what Angular Material puts on every
  ligature `<mat-icon>`. Remove that rule and every icon reverts to its literal text.

## 8. If `npm install` starts failing

Two distinct failures showed up while setting this up. They look similar and are not.

**`Invalid Version:` — a corrupt lockfile, not the network.** An install interrupted
mid-write can leave a `package-lock.json` containing entries with no `version`, plus empty
package directories. Every later install then dies in npm's dedupe step *before making any
network request*, and no amount of retrying helps. The fix:

```bash
rm -rf node_modules package-lock.json && npm install
```

**`ERR_SSL_DECRYPTION_FAILED_OR_BAD_RECORD_MAC` / `cipher operation failed` — the
network.** This one is intermittent and hits every TLS client on the machine (npm, `curl`,
PowerShell), so it is not an npm bug. Retrying often gets through. If it persists: use a
different network or hotspot, turn the VPN off, disable the endpoint agent's HTTPS
scanning, or configure the proxy explicitly (`npm config set proxy` / `https-proxy`, and
the CA via `cafile`).

The important interaction: a TLS drop *causes* the interrupted install that writes the
corrupt lockfile. So if retries suddenly stop making progress, delete the lockfile before
blaming the network.
