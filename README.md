# WhatsApp Sales Automation — Admin Panel (Angular)

Angular 15 admin panel for the WhatsApp Marketing + AI Sales Automation platform. This
repo covers **Phases 2 and 3** of the backend: authentication, users & roles, customer
management (Phase 2, see [docs/PHASE2-BACKEND-SETUP.md](docs/PHASE2-BACKEND-SETUP.md)),
plus campaigns, the media library and message templates (Phase 3).

Phases 4–6 (agent inbox, knowledge base, leads/CRM, reports) are deliberately absent:
their APIs do not exist yet.

---

## 1. Status

Verified working:

- `npm install` — clean
- `npm run build` — succeeds in both development and production configurations
- `npm test` — 52 specs, all passing (ChromeHeadless)
- `npm start` — serves at `http://localhost:4200`, login screen renders, and
  `/api/v1/*` proxies to the backend (an unauthenticated call to every endpoint group,
  including the Phase 3 ones, returns 401 from the API, same as calling it directly)
- API contract — every request and response shape checked against
  `/swagger/v1/swagger.json` on the running backend (see §6), including the Phase 3
  additions, by reading the corresponding controller/service/validator source

Not verified: **the authenticated screens have never been exercised against real data.**
Nothing beyond compile-correctness, contract match, and unit tests — sign in and click
through. This is especially true for Phase 3: the campaign step builder, the media
picker, and the lifecycle actions (start/pause/resume/stop) have a lot of client-side
state and have never been run against a real campaign.

## 2. Prerequisites

- Node.js `^14.20 || ^16.13 || ^18.10` (Angular 15's supported range; 18.x LTS is the
  safe pick)
- npm 8+
- The .NET API running locally (Phase 2 + Phase 3)

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
  },
  "/media": {
    "target": "https://localhost:59205",
    "secure": false,
    "changeOrigin": true
  }
}
```

`"secure": false` accepts the ASP.NET Core dev certificate. **Both entries are required** —
`/media` proxies the uploaded-file URLs `MediaAssetDto.url` returns (see §6, Phase 3 note
10); missing it is the one config mistake that looks like a bug (uploads "work" but the
image never renders) rather than a config error. `proxy.conf.json` only loads at startup,
so change the target and restart `npm start` — it will not pick up edits live. Then:

```bash
npm start
```

The app serves at `http://localhost:4200` and proxies `/api/*` and `/media/*` to the
backend, so there is no CORS configuration to do in development.

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
| Campaigns | Paged/searchable list, detail page (overview, step builder, audience, lifecycle actions, progress breakdown), create/edit, delete (Draft only), a global "Run jobs now" trigger for SuperAdmin | `GET/POST /campaigns`, `GET/PUT/DELETE /campaigns/{id}`, `POST /campaigns/{id}/steps`, `DELETE /campaigns/{id}/steps/{stepType}`, `POST /campaigns/{id}/audience`, `POST /campaigns/{id}/start\|pause\|resume\|stop`, `GET /campaigns/{id}/progress`, `POST /campaigns/ops/run-jobs` |
| Media Library | Searchable grid, drag-drop upload with progress, delete (with a force-delete path when an asset is still attached to a campaign step) | `GET/POST /media`, `POST /media/upload`, `GET/DELETE /media/{id}` |
| Message Templates | Paged/searchable list, create/edit, review (Approve/Reject/Reset — SuperAdmin/Admin only), delete | `GET/POST /message-templates`, `GET/PUT/DELETE /message-templates/{id}`, `POST /message-templates/{id}/review` |

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
    services/    auth, token storage, customer, user, tag, campaign, media, message-template, notification
    utils/       validators mirroring backend rules: phone-number, tag-name, placeholder-tokens
  shared/        SharedModule — Material re-exports, confirm dialog, page header, hasRole directive
  layout/        app shell (sidenav + toolbar)
  features/      lazy-loaded route modules: auth, account, dashboard, customers, tags,
                 users, campaigns, media, message-templates
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
4. **Tags can now be both added and removed.** This repo's API gained
   `DELETE /customers/{id}/tags/{tagName}` (added alongside the frontend change that
   uses it, matching how the campaign audience gap was closed — see
   `CustomerService.RemoveTagAsync`) — case-insensitive match, a no-op rather than an
   error if the customer never had that tag, and it detaches the join row only, never
   the `CustomerTag` entity itself (other customers may still reference it). Removal in
   [`CustomerFormDialogComponent`](src/app/features/customers/customer-form-dialog/customer-form-dialog.component.ts)
   is staged, not immediate — clicking the X marks a tag for removal (shown
   struck-through with an undo), and it's only actually deleted when you click Save,
   alongside whatever new tags were added in the same session. Re-typing a tag that's
   staged for removal just cancels the removal rather than queuing a redundant
   remove-then-re-add round trip.
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

### Phase 3: campaigns, media, message templates

Swagger doesn't carry business rules — state machines, config-driven limits, or which
fields are immutable — so these were read from the backend source
(`CampaignService`, `CampaignValidators`, `MediaService`, `MessageTemplateService`, the
domain enums) rather than guessed:

1. **Campaign status is a state machine, and every action is gated client-side to match
   it exactly** — see the `can*` functions in
   [`campaign.model.ts`](src/app/core/models/campaign.model.ts). Edit: Draft, Scheduled,
   or Paused — a Scheduled campaign hasn't sent anything yet, so its fields are still
   safe to change; clearing the date on a Scheduled campaign falls it back to Draft
   server-side, since nothing would ever promote it out of Scheduled again with no date
   to promote on. Delete: Draft only. Steps: Draft or Paused. Audience: anything except
   Stopped/Completed. Start: Draft only (Resume is the equivalent action from Paused —
   same server-side check, but a distinct endpoint). Pause: Running or Scheduled. Stop:
   anything except Stopped/Completed. These mirror `CampaignService.RequireStatus` — if
   the backend's allowed-status lists change, this is the one place to update.
2. **Media count is a server-configured range, enforced at both step-save and Start
   time, not a fixed number the client can validate against.** `CampaignOptions`
   (`Campaigns:MinStepMedia`/`MaxStepMedia`) is bound from `appsettings.json`, and the
   Phase 1 spec's 2–5 is only a default — this repo's API currently runs with
   `MinStepMedia: 0`, so a step (and a campaign) can be created and started without
   first sourcing 2–5 real media assets. Because there's no endpoint exposing the live
   value and it has already changed once during this build, the step dialog does **not**
   client-side block on a count at all — it shows an informational hint and lets the
   server's own response (400 on save, 409 on Start) be the one source of truth. A
   hardcoded client minimum would silently drift out of sync every time this changes.
3. Starting a campaign also requires an active Initial step and, on every active step,
   **an assigned template that is both `Approved` and active**. The step dialog lets you
   save a step missing a template or with a Pending template (useful while building a
   campaign before templates are approved) — Start's 409 is what actually enforces this,
   surfaced via `ErrorInterceptor`.
4. **There is no endpoint to *remove* a customer from a campaign's audience** — only
   `POST .../audience` to add more by tag name or customer id, additive and safe to call
   repeatedly. `GET .../audience` (added alongside the roster table on the detail page —
   see `CampaignService.getAudience` and
   [`CampaignDetailComponent`](src/app/features/campaigns/campaign-detail/campaign-detail.component.ts))
   lets you see who's attached, their per-campaign status, and their current step, but
   there's still no way to detach anyone once added. `SetAudienceRequestValidator`
   requires at least one tag or id on the add call; a matched-but-not-opted-in customer
   is silently excluded and counted in `notOptedInCount` rather than rejecting the whole
   call.
5. **Two ways to force the send pipeline early, instead of waiting for the next scheduled
   tick.** `POST /campaigns/ops/run-jobs` has no id in its route and runs across every
   eligible campaign at once — **SuperAdmin only**, the button on the campaign list is
   hidden via `*appHasRole` for everyone else, same UI-only-gate caveat as elsewhere.
   `POST /campaigns/{id}/run-jobs` is the same pipeline (initial sends, then follow-ups,
   then retries) scoped to one campaign — a narrower, per-campaign version, so it carries
   no extra role restriction beyond the base `[Authorize]` every other campaign endpoint
   has (see point 7 below). It's a guaranteed no-op unless that campaign is Scheduled (due
   to promote) or Running — `canRunCampaignJobs` in `campaign.model.ts` hides the detail
   page's "Run job now" button otherwise rather than offering a dead click.
6. **Message templates: only `bodyText` and `isActive` are editable after creation** —
   name, language, category and the Meta-registered `whatsAppTemplateName` are fixed.
   Editing the body of an `Approved` template **silently reverts it to Pending**
   server-side; [`TemplateFormDialogComponent`](src/app/features/message-templates/template-form-dialog/template-form-dialog.component.ts)
   detects this client-side and warns before you save, but the backend enforces it
   regardless.
7. **The `review` action is SuperAdmin/Admin only**; every other template/campaign/media
   endpoint accepts any authenticated user. It's a first-class button on each row (not
   hidden inside the overflow menu) for exactly the roles that can use it — approving a
   template is what lets a campaign use it at all, so burying that action was a real
   discoverability problem, not just a role-gating one. Deleting a template referenced by
   any campaign step 409s with **no force option** — unlike tags and media, you must
   remove it from the step first.
8. **Media has no in-use counter** the way `TagDto.customerCount` does, so
   [`MediaListComponent.delete`](src/app/features/media/media-list/media-list.component.ts)
   can't decide up front whether to force. It always attempts a plain delete first; a 409
   triggers a second confirm offering `force=true`. Uploads are deduplicated by content
   checksum server-side — uploading identical bytes twice returns the existing asset.
9. **`{{Token}}` placeholders are restricted to `FirstName`, `LastName`, `PhoneNumber`**,
   in both campaign step message text and template body text, enforced by the same
   `TemplatePlaceholderResolver` pattern on the backend and mirrored in
   [`placeholder-tokens.ts`](src/app/core/utils/placeholder-tokens.ts). The regex requires
   no whitespace inside the braces — `{{First Name}}` isn't flagged as invalid, it's
   simply never recognized as a placeholder at all (and so is sent to WhatsApp verbatim,
   unsubstituted). This is a real trap the UI does not fully protect against; the token
   quick-insert buttons exist specifically to avoid typing braces by hand. **This list is
   hardcoded server-side** — there is no way for a template or step to introduce a new
   named placeholder (e.g. `{{CompanyName}}`) without a real customer field for the
   resolver to read from, since an unmapped token silently resolves to an empty string
   at send time rather than erroring. See §7 for what a real fix would need.
10. **There is no cap on the number of follow-ups, and steps must be attached and
    removed strictly in sequence.** This replaced what was originally a closed
    `CampaignStepType` enum (Initial + FollowUp1-4, five slots only) — the backend now
    derives a step's name from its position instead
    (`CampaignStepTypeName.ForNumber`/`TryParse`: 0 is "Initial", every number above 0 is
    "FollowUp{N}", unbounded), and the DB column widened from `nvarchar(20)` to
    `nvarchar(50)` to match. `CampaignStep.StepType` is a plain string, not an enum,
    for the same reason a fixed C# enum can't represent an open-ended set of names.
    Steps still can't skip positions: `UpsertStepAsync` 400s if an earlier one is
    missing, and `RemoveStepAsync` 409s if a later one still exists — the send pipeline
    walks the sequence one position at a time, and a true gap (no step there at all, as
    opposed to one merely deactivated) makes it give up and mark the customer Completed,
    silently dropping every follow-up after it.
    [`campaign.model.ts`](src/app/core/models/campaign.model.ts) mirrors this exactly:
    `formatStepTypeName`/`parseStepTypeName` for the name↔number mapping, `nextStepNumber`
    for "the one position addable right now" (always exactly one past the highest
    existing step — never null, since there's no ceiling to hit), and `isLastStep` for
    the removal rule. "Add step" on the detail page is a single button
    (`Add {{ nextStepLabel }}`) reflecting that there's only ever one valid choice, and a
    step's Remove button is disabled unless it's the last one. A step's type still can't
    be changed once created — changing it means removing from the end and re-adding.
    Deactivating a step in place (`isActive`) is unaffected by any of this — the send
    pipeline is deliberately gap-*tolerant* for that case, only not for a step that was
    never attached or was removed.
11. **`MediaAssetDto.url` is host-relative, not absolute.** In local dev,
    `MediaStorage:PublicBaseUrl` is empty (`appsettings.json`), so the API returns e.g.
    `/media/2026/08/<guid>.jpg` — a path with no scheme or host. `<img [src]="asset.url">`
    resolves a relative URL against the *current page's* origin, so without a proxy entry
    an uploaded image tries to load from the Angular dev server (`:4200`) instead of the
    API (`:59205`) and 404s — the browser never even asks the right server. `/media` is
    proxied in [proxy.conf.json](proxy.conf.json) for exactly this reason, mirroring
    `/api`. **This means production needs the same fix**: whatever serves the built
    static files must also route `/media` (or your configured `PublicBasePath`) to the
    API — the same requirement `/api` already has, just easy to miss because it's a
    second, differently-shaped path.

## 7. Known gaps

- **No custom placeholders beyond `FirstName`/`LastName`/`PhoneNumber`.** This was asked
  for and deliberately *not* built: `TemplatePlaceholderResolver.KnownTokens` is a fixed
  list on the backend, and an unrecognized token resolves to an empty string at send
  time rather than erroring — so relaxing the validator (client or server) without
  giving the resolver somewhere real to read a new value from (e.g. `{{CompanyName}}`)
  would let a user save a message that looks correct in the editor and then sends with
  a silent blank where that text should be. A real fix needs a customer custom-field
  schema (admin UI to define fields, storage, and a resolver update to read them) — a
  genuine feature, not a validation tweak. Flagging this rather than shipping a
  half-working version of it.
- **No forgot/reset password.** The Phase 2 API has no such endpoint; the login screen
  says so rather than offering a dead link.
- **No admin password reset.** Editing a user cannot change their password.
- **Tokens in `localStorage`** are XSS-exposed. The alternative — an HttpOnly refresh
  cookie — needs backend support the current API does not provide.
- **Test coverage is services and pure validators, not components.** No component
  (dialog, list, detail page) has a spec — matching the backend's own deferral of test
  projects to Phase 6. The 52 specs check HTTP request shapes and the client-side rules
  mirrored from the backend (phone/tag/placeholder validation, campaign status gating
  logic), not rendering or user interaction.
- **Media picker and template select load a single page.** The campaign step dialog's
  media autocomplete searches server-side (fine at any scale), but the template dropdown
  fetches one page of 100 — same admin-panel-scale assumption as the roles list in
  `UserRolesDialog`. A deployment with more than ~100 templates would need that changed
  to a searchable picker.
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
