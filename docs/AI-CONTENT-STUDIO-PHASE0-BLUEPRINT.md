# AI Content Studio — Phase 0: Existing Application Analysis & Implementation Blueprint

Status: **analysis only. No code, schema, configuration or dependency was changed.**
Repos inspected (latest `main` / `master` pulled, branch `feature/ai-content-studio-phase0-analysis` cut in both):
- `AI-Sales-Automation-System-api` (.NET 8, branch base `master` @ 02a393a)
- `AI-Sales-Automation-System-angular` (Angular 15, branch base `main` @ 317f1ee)

Legend — **[V]** verified in the repository · **[P]** proposed (does not exist) · **[?]** unverified, must be confirmed before relying on it.

---

## 1. Existing architecture and reusable-component inventory

### 1.1 Stack [V]
| Area | Finding |
|---|---|
| Backend | .NET 8, Clean Architecture in 4 projects (`Domain`, `Application`, `Infrastructure`, `Api`); 57 controllers, ~340 endpoints under `api/v1/*`; FluentValidation; Swashbuckle (`/swagger/v1/swagger.json`) |
| Data | EF Core 8 on SQL Server; 138 migration files; tenant filter + soft-delete filter in `ApplicationDbContext` |
| Auth | ASP.NET Identity + JWT bearer (+ refresh tokens); roles `Admin`, `SalesManager`, `SalesAgent`, `PlatformSuperAdmin` (`AppRoles`); impersonation recorded as `AuditLog.ImpersonatedBy` |
| Jobs | **Hangfire on SQL Server**, schema `Hangfire`, server **embedded in the API process** (`AddHangfireServer()`, default queue; source comment: "dedicated worker … is future work") |
| Storage | `IMediaStorageService` → `RoutingMediaStorageService` → local disk (`App_Data/media`) or **S3** (`AWSSDK.S3`), switched by platform setting |
| Secrets | `ISecretProtector` (ASP.NET Data Protection, key ring on local disk `App_Data/keys`); `AppSettings` table with secret flag, edited from the Platform Admin Console |
| Logging | Serilog (console + file), `TenantLogScope` tags every line with tenant |
| Realtime | SignalR hubs (`NotificationsHub`, `ConversationHub`), in-memory backplane |
| Rate limiting | Fixed-window `Auth` / `Webhook` / `Api` policies |
| Tests | xUnit + SQLite + TestHost (83 test files); CI in `.github/workflows/ci.yml` |
| Frontend | Angular 15 + Angular Material 15, NgModule feature modules, lazy routes in `app-routing.module.ts`, one `core/services/*.service.ts` per API area, `shared/` components, SignalR client; Karma/Jasmine (111 specs) |

### 1.2 Reusable components (reuse, do not rebuild)
| Need | Existing component [V] | Fit |
|---|---|---|
| Tenant isolation | `ITenantOwned` + global query filter + `TenantStampingSaveChangesInterceptor`; `ITenantContext.SetTenant` for jobs; `EnterPlatformScope` for platform data | **Direct reuse.** Every new tenant table implements `ITenantOwned`. |
| Tenant business facts | `Tenant` already holds `Industry`, `IndustrySubcategory`, `BusinessDescription`, `TargetAudience`, `TargetLocation`, `TargetCustomerType`, `BusinessLocation`, `WorkingHours`, `DomainKeywords`, `WebsiteUrl` | Seed answers for questionnaires; do not ask twice. |
| Verified knowledge | `KnowledgeBaseArticle` (+versions, chunks, embeddings, ingestion job, retrieval service, `AuthorityRank`, `SourceType`, tenant vs global scope) | Reuse as the **retrieval source** for scripts. Whether it has a human "verified" state is **[?]** — `AuthorityRank/SourceType` exist, an explicit approval flag was not confirmed. |
| Text AI | `IAiTextGenerator.GenerateAsync(system, user, maxTokens)` (one-shot, null on failure/simulated); `IAiService` (conversation-shaped); providers OpenAI / Anthropic / Google / Simulated via platform-wide config (`PlatformAiConfigProvider`) | Reuse `IAiTextGenerator` for topics/scripts/scenes. It returns plain text only; structured JSON output must be prompt-enforced and validated [P]. |
| AI metering | `IAiUsageService` Authorize → Complete / Fail (refund) with `AiTransaction` audit; trial vs paid source | **Reuse the gate.** A generation is one authorise/complete/fail cycle. |
| Quota/billing | `QuotaType` has exactly 3 values (`WhatsAppMessages`, `AiConversations`, `LeadCandidates`); `PlanQuota`, `QuotaGrant`, `QuotaLedgerEntry`, `IQuotaGate`, Razorpay, refunds | Extend, don't fork (see §3, decision D4). |
| Web research agent pattern | `AnthropicLeadDiscoveryAgent` uses Anthropic server-side `web_search`/`web_fetch` tools with a tool-submit schema | Template for "automatic discovery" of reference material. |
| File storage | `IMediaStorageService`, `MediaAsset` (checksum de-dupe, thumbnail key, per-tenant `ITenantOwned`), `MediaService`, S3 settings editable in Platform Console | Reuse for uploaded images and rendered output. **Limits don't fit video** (below). |
| Background work | Hangfire; `TenantJobRunner` (per-tenant scope, outcome recording), `TenantJobSchedule`/`TenantJobCatalog` for recurring work; `HangfireKnowledgeIngestionQueue` / `HangfireLeadDiscoveryRetryScheduler` as the **one-off enqueue** pattern | Reuse patterns; render queue needs its own worker (§6). |
| OAuth connection pattern | `SocialAdConnection` + `SocialAdsController` (connect-url → connect → select-account → sync → disconnect), token encrypted via `ISecretProtector`, never returned by API | **Closest analogue** for YouTube/Instagram connections. |
| Dynamic fields | `QualificationField` + `QualificationDataType` (tenant-defined lead fields) | Pattern reference only; questionnaire needs conditionals it lacks. |
| Audit | `AuditLog` (tenant, entity, action, changes JSON, actor, impersonator, IP); `PlatformAuditLogEntry` | Reuse for approve/publish/disconnect events. |
| Notifications | `TenantNotification`, SignalR broadcaster | Render-complete / publish-failed notices. |
| Onboarding | `OnboardingCatalog` (steps with weights summing to 100, each step judged by real data on its real screen) | Optional later step; weights must be rebalanced (a test enforces 100). |
| Retention | `DataRetentionService` + `DataRetentionJob` + `RetentionOptions` | Add content/render retention passes here. |
| Frontend | Feature-module + service-per-area convention; `page-header`, `confirm-dialog`, `meta-connect-card`, `tenant-job-list` shared components; "list left, panel right, stay on the page" UX rule | Follow it. |

### 1.3 Explicitly **not** present [V — repository-wide search]
- No video/audio tooling (no FFmpeg, no renderer, no TTS), no image generation or **vision/multimodal input** in any AI client (text + tool-use only) **[?]** confirm in Phase 1 by reading the three clients end to end.
- No stock-asset provider (Pexels/Unsplash/Pixabay etc.), no screenshot/headless-browser capability.
- No YouTube or Instagram **publishing** code. "Instagram" appears only as an ad-spend *placement* in Meta Ads reporting (read-only).
- No questionnaire engine with conditional logic.
- No generic multi-step content/approval workflow.
- No Dockerfile/compose (DEPLOYMENT.md: containers deliberately not covered).

### 1.4 Existing constraints that shape the design [V]
1. **Media limits**: `Media:MaxSizeBytes` = 16 MB; allowed types `jpeg/png/webp/mp4/3gpp` (sized for WhatsApp). Rendered video and 4K sources exceed this; limit is a global setting, so a separate path/limits for Studio assets is needed, not a global raise.
2. **S3 bucket is platform-wide and must be publicly readable** (Meta fetches by URL). Fine for approved public marketing output; **wrong for drafts, raw uploads and tenant source material.**
3. **Hangfire runs inside the API process.** CPU-heavy rendering there will starve request handling.
4. **Single-instance assumptions** (DEPLOYMENT.md): local Data Protection key ring, local media, in-memory SignalR. Multi-worker render needs a shared key ring (to decrypt social tokens) and shared storage.
5. **AI provider is platform-wide** (tenants never choose/see a provider); every AI call goes through `IAiUsageService`.
6. **Primary currency is INR for operator-facing money**; storage base is USD.
7. Roles: only `Admin` should connect external accounts (matches `SocialAdsController`).
8. `docs/credentials/` holds an AWS access-key CSV on disk — verified **git-ignored**, not tracked. Still recommend rotating and moving it out of the repo directory. `docs/TODO-BEFORE-PRODUCTION.md` claims live secrets in tracked `appsettings.json`; current file shows empty keys, so that note looks stale **[?]** (git history was not audited).

---

## 2. Functional gap analysis

| # | Requirement | Existing | Gap | Size |
|---|---|---|---|---|
| 1 | Dynamic questionnaires (MCQ, short text, structured, conditional) | Fixed onboarding steps; `QualificationField` | Question/Option/Rule model, versioned templates, answer store, conditional evaluator, designer UI (platform) + wizard UI (tenant) | M |
| 2 | Tenant-specific verified knowledge | KB articles w/ ingestion, retrieval, authority | "Fact" with source + verified-by + verified-at; claims-to-facts linkage; block unverified claims in scripts | M |
| 3 | Topics, scripts, scene breakdown | `IAiTextGenerator`, usage gate | Prompt library, JSON schema validation, grounding to facts, claim check, regeneration | M |
| 4 | Asset discovery & matching | `MediaAsset`, embeddings (`IEmbeddingService`) | Stock providers, ranking/matching to scene text, licence capture, "illustration vs real" labelling | L |
| 5 | Real product screenshots | none | Either tenant upload (cheap, recommended) or headless capture of the tenant's own app (heavy, security-sensitive) | L / S |
| 6 | Video rendering | none | Renderer, TTS/captions, music/licensing, worker, progress | XL |
| 7 | Review & approval | `AuditLog`, notifications | Versioned content states, per-scene edit, reject-with-reason, immutable approved snapshot | M |
| 8 | YouTube + Instagram publishing | Meta OAuth pattern (ads, read-only) | Two new OAuth integrations, upload/publish clients, status polling, retry, token refresh | XL |
| 9 | Status, retry, analytics | Hangfire retries; job outcome recording | Publication state machine, idempotency, metrics sync job | L |
| 10 | Strict tenant isolation | Strong baseline | Apply to new tables, new storage prefix, signed URLs, tests proving cross-tenant denial | S (design) |

---

## 3. Proposed module boundaries and integration points [P]

New bounded context `ContentStudio` mirrored across layers (`Application/ContentStudio`, `Domain/Entities/ContentStudio`, `Infrastructure/ContentStudio`, `Api/Controllers/ContentStudio*`). Sub-areas (each a service interface in Application, provider-agnostic):

| Sub-module | Responsibility | Integrates with (existing) |
|---|---|---|
| **Questionnaire** | templates, versions, rules, answers | `Tenant` profile (prefill), `OnboardingCatalog` (optional step) |
| **Knowledge (Facts)** | verified facts, source docs | `KnowledgeBaseArticle` retrieval (reuse, don't copy) |
| **Ideation & Scripting** | topics → script → scenes | `IAiTextGenerator`, `IAiUsageService`, Facts |
| **Assets** | uploads, stock search, matching, licence log | `MediaAsset`/`IMediaStorageService`, `IEmbeddingService`; new `IStockAssetProvider` |
| **Rendering** | scene plan → MP4, thumbnails | new `IVideoRenderer`, `ITextToSpeech`; storage |
| **Review** | draft/approve/reject, versions | `AuditLog`, `TenantNotification` |
| **Publishing** | connections, publish, retry, analytics | pattern from `SocialAdsService`; `ISecretProtector`; Hangfire |

Dependency rule: Application defines interfaces (`IVideoRenderer`, `IStockAssetProvider`, `ISocialPublisher` with YouTube/Instagram implementations in Infrastructure), mirroring how `IMetaAdsClient` / `IMediaStorageService` are done. No NayanCare logic anywhere: industry specifics live in **questionnaire template data**, **prompt-pack data** and **compliance-rule data** (rows, editable from the Platform Console), never in code.

Frontend: lazy `content-studio` feature module (child routes: projects list/detail with panel-on-right, questionnaire wizard, script/scene editor, asset picker, review, publishing + connections); `core/services/content-studio*.service.ts`; sidenav entry gated by plan/module flag.

---

## 4. Proposed database entities and relationships [P]

All tenant tables: `BaseEntity` + `ITenantOwned` (+ `ISoftDelete` where noted). Enums stored as strings, per existing convention.

```
QuestionnaireTemplate (platform-owned, global; Industry?, Version, Status)
 └─ QuestionnaireQuestion (TemplateId, Key, Type[Mcq|Short|Structured|Number|Boolean], Prompt, OptionsJson, ValidationJson, Order)
     └─ QuestionnaireRule (QuestionId, DependsOnQuestionKey, Operator, ValueJson)   -- conditional display
QuestionnaireResponse (tenant; TemplateId+Version, Status, CompletedAt)
 └─ QuestionnaireAnswer (ResponseId, QuestionKey, ValueJson)

BusinessFact (tenant; Category, Statement, SourceType[Questionnaire|Document|Url|Manual], SourceRef,
              VerificationStatus[Draft|Verified|Retired], VerifiedBy, VerifiedAt, KnowledgeArticleId?)
ComplianceRule (platform/global or tenant; Industry?, Pattern/Text, Severity, Message)   -- e.g. banned claims

ContentProject (tenant; Title, Goal, Language, Status, CurrentVersionId)
 ├─ ContentTopic (ProjectId, Title, Rationale, Status[Suggested|Chosen|Rejected])
 ├─ ContentVersion (ProjectId, Number, ScriptText, Status[Draft|InReview|Approved|Rejected], ApprovedBy, ApprovedAt, ContentHash, PromptVersion, AiTransactionId)
 │   └─ ContentScene (VersionId, Order, Narration, OnScreenText, DurationSec, AssetKind, ChosenAssetId?)
 │        └─ SceneFactRef (SceneId, FactId)            -- grounding / claim traceability
 └─ ReviewEvent (VersionId, Action, Actor, Comment, At)

StudioAsset (tenant; Kind[Upload|Screenshot|Stock|Illustration|Generated|Render], Origin label, MediaAssetId?,
             StorageKey, ProviderName, ProviderAssetId, LicenseType, Attribution, SourceUrl, Checksum, EmbeddingRef?)
SceneAssetCandidate (SceneId, AssetId, Score, Chosen)

RenderJob (tenant; VersionId, Status[Queued|Running|Succeeded|Failed|Cancelled], Attempt, Progress, OutputStudioAssetId?,
           Error, HangfireJobId, RendererName, StartedAt, FinishedAt)

SocialConnection (tenant; Platform[YouTube|Instagram], ExternalAccountId/Name, Status, EncryptedAccessToken,
                  EncryptedRefreshToken, TokenExpiresAt, Scopes, ConnectedBy, LastError)
Publication (tenant; VersionId, RenderJobId, ConnectionId, Platform, Status[Scheduled|Uploading|Processing|Published|Failed|Cancelled],
             ExternalPostId, Url, ScheduledAt, PublishedAt, Attempts, NextRetryAt, IdempotencyKey, LastError)
PublicationMetricSnapshot (PublicationId, CapturedAt, Views, Likes, Comments, Shares, WatchTimeSec, RawJson)
```
Notes: reuse `AiTransaction` by foreign key rather than a parallel usage table; new `QuotaType` values (e.g. `ContentGenerations`, `VideoRenders`) rather than a new ledger. Approved `ContentVersion` is immutable (hash-checked) so what was approved is what is published.

---

## 5. Proposed API endpoints and authorization [P]
Base `api/v1/content-studio`. Roles: **A** = Admin, **M** = SalesManager, **S** = SalesAgent (read), **P** = PlatformSuperAdmin. Rate-limit policy `Api`; heavy endpoints get a tighter policy.

| Area | Endpoints | Roles |
|---|---|---|
| Questionnaire (tenant) | `GET questionnaire` (current template + prefilled answers) · `PUT questionnaire/answers` · `POST questionnaire/complete` | A, M |
| Questionnaire (platform) | `GET/POST/PUT /platform/content-studio/questionnaire-templates[...]` · publish version | P |
| Facts | `GET/POST/PUT/DELETE facts` · `POST facts/{id}/verify` · `POST facts/import-from-kb` | read A,M,S · write A,M · **verify A only** |
| Projects | `GET/POST projects` · `GET/PUT/DELETE projects/{id}` | A, M |
| Ideation | `POST projects/{id}/topics:generate` · `PUT topics/{id}` | A, M (metered) |
| Script | `POST projects/{id}/script:generate` · `PUT versions/{v}` · `PUT scenes/{id}` · `POST versions/{v}/claim-check` | A, M (metered) |
| Assets | `POST assets` (upload) · `GET assets` · `POST scenes/{id}/assets:match` · `POST scenes/{id}/assets:search-stock` · `PUT scenes/{id}/asset` | A, M |
| Render | `POST versions/{v}/render` · `GET render-jobs/{id}` · `POST render-jobs/{id}/cancel` | A, M (metered) |
| Review | `POST versions/{v}/submit` · `POST versions/{v}/approve` · `POST versions/{v}/reject` | submit A,M · **approve A only** |
| Connections | `GET connections` · `GET connections/{platform}/connect-url` · `POST connections/{platform}/connect` · `DELETE connections/{id}` | **A only** (mirrors `SocialAdsController`); tokens never returned |
| Publishing | `POST versions/{v}/publish` (platform, schedule, idempotency key) · `GET publications` · `POST publications/{id}/retry` · `POST publications/{id}/cancel` | A (approve gate enforced server-side) |
| Analytics | `GET publications/{id}/metrics` · `GET analytics/summary` | A, M |
| Platform ops | usage, render queue health, per-tenant disable switch | P |

Server-side invariants (not UI-only): publish requires `Approved` version whose hash matches; approver ≠ unverified-claim bypass; all queries tenant-filtered; ids from other tenants return 404, not 403.

---

## 6. Background-job and storage requirements [P]

**Jobs (Hangfire)**
- One-off: `RenderVideoJob(renderJobId)`, `PublishJob(publicationId)`, `ProcessPublishStatusJob`, `IngestFactsJob` (reuse KB ingestion queue pattern).
- Recurring (via `TenantJobCatalog`): `SyncPublicationMetrics`, `RefreshSocialTokens` (pattern: `WhatsAppTokenRefreshJob`), render/asset retention in `DataRetentionService`.
- **Dedicated queues** (`render`, `publish`, `default`) and a **separate worker process** for `render` — rendering must not run in the API process (verified: today it would). Concurrency capped globally and per tenant (`DisableConcurrentExecutionPerTenantAttribute` already exists).
- Idempotency: `Publication.IdempotencyKey`; never re-upload a video that already has an `ExternalPostId`. Retries with backoff only for transient errors; policy/quota errors go straight to `Failed` with a tenant-readable message.
- Every job sets `ITenantContext.SetTenant` (via `TenantJobRunner`-style scope).

**Storage**
- New key prefix per tenant: `studio/{tenantId}/{projectId}/…` with three zones: `private/` (uploads, drafts, raw stock) via **pre-signed URLs only**; `render/` (outputs); `public/` only for the moment Instagram needs a fetchable URL (short-lived signed URL preferred, then purge).
- Studio-specific size/type limits (videos to hundreds of MB), separate from `Media:*` WhatsApp limits.
- Disk: renders need scratch space + cleanup; Angular/.NET caches already have filled the dev drive before.

---

## 7. External API dependencies and account prerequisites

| Dependency | What is needed | Prerequisite / lead time [?] verify current policy |
|---|---|---|
| **YouTube Data API v3** | Google Cloud project, OAuth consent screen, scope `youtube.upload` (sensitive) | **Google OAuth verification**, and YouTube API Services **compliance audit**, otherwise uploads from unaudited projects are restricted to private. Default quota 10,000 units/day with an upload costing ~1,600 → ~6 uploads/day platform-wide until extended. Weeks of lead time. |
| **Instagram Graph API (content publishing)** | Instagram **Professional** account linked to a Facebook Page; scopes `instagram_content_publish`, `instagram_basic`, `pages_show_list`; container → publish flow; video must be fetched from a public URL | **Meta App Review** + likely Business Verification; per-account daily publish cap. Decide whether to reuse the existing Meta app (WhatsApp + Ads) or a new one (D6). |
| LLM (existing) | Platform-wide OpenAI/Anthropic/Google keys | None new. Structured-output reliability to be tested. |
| Stock imagery/video | e.g. Pexels, Pixabay, Unsplash APIs — **not in repo; choice open** | Free API keys; **licence/attribution terms vary** and must be captured per asset. |
| Illustration / image generation | provider TBD (D3) | Must always be labelled "illustration" in-product and in output. |
| TTS / voiceover | provider TBD (D2); Indian-language support matters | Per-character cost; voice licensing. |
| Music | royalty-free source TBD | Licence capture. |
| Renderer | FFmpeg (self-hosted worker) **or** hosted render API | Server binary + fonts; or vendor contract (D1). |
| S3 | exists | New prefix + bucket policy split (private vs public). |

---

## 8. Security, privacy, consent and retention risks

| # | Risk | Mitigation [P] |
|---|---|---|
| R1 | **Hallucinated / unverifiable claims** (critical for health, finance, legal tenants) | Scripts may only assert `Verified` facts; claim-check pass; `ComplianceRule` data per industry; approval mandatory; human sign-off logged. |
| R2 | **Cross-tenant leakage** via storage URLs, job context, shared prompt cache | `ITenantOwned` everywhere; signed URLs; per-tenant prefixes; no tenant data in prompt cache keys; negative tests per endpoint. |
| R3 | **OAuth token theft / over-scoping** | Encrypt via `ISecretProtector`; minimal scopes; never in API responses/logs; shared key ring before any multi-instance (otherwise tokens become undecryptable); revoke on disconnect; Admin-only. |
| R4 | **Personal data in assets** (patient faces/records in screenshots or uploads) | Upload attestation checkbox, consent record, no auto-scraping of tenant apps with real patient data, blur/redaction guidance; retention limits. India **DPDP Act 2023** consent/purpose limits to be reviewed by counsel. |
| R5 | **Copyright / licence** for stock, music, fonts | Store licence + attribution per `StudioAsset`; block assets with unknown licence; keep provenance. |
| R6 | **Synthetic-media transparency** | Label illustrations/AI visuals and AI voice; platform AI-disclosure toggles (YouTube "altered content", Instagram labels). |
| R7 | **Cost runaway** (LLM, TTS, render CPU, S3 egress) | Metered quotas via ledger; per-tenant concurrency; hard caps; platform kill-switch. |
| R8 | **Publish mistakes** (wrong account, unapproved content, double post) | Approved-hash gate, idempotency key, confirm dialog showing account + preview, cancel window. |
| R9 | **Public bucket exposure** of drafts | Private by default; signed URLs; separate public prefix only for approved outputs. |
| R10 | **Platform policy bans** (spam, medical claims on Instagram/YouTube) | Rate caps, content-policy rule set, no auto-posting without approval. |
| R11 | **Retention/erasure** | New retention passes in `DataRetentionService`; tenant offboarding deletes studio storage prefix + tokens; revoke external grants. |
| R12 | Embedded Hangfire dashboard / single instance (existing) | Don't widen exposure; fix key ring/storage before scaling workers. |

---

## 9. Phased implementation plan with dependencies

| Phase | Scope | Depends on | Notes |
|---|---|---|---|
| **1 — Foundations** | Module skeleton, feature flag/plan gate, `QuotaType` extension, Studio storage prefix + signed URLs, new entities & migration, authorization policies, audit hooks, confirm AI client capabilities | decisions D4, D5 | No user-visible feature yet |
| **2 — Questionnaire & Facts** | Template engine (conditional), tenant wizard, platform template editor, `BusinessFact` + verification, KB link | 1 | Seed generic templates; NayanCare = data |
| **3 — Ideation & Script** | Topics, script, scenes; grounding; claim-check; metered AI; prompt packs as data | 2 | Sufficient to demo value without video |
| **4 — Assets** | Uploads, screenshots upload, stock search, matching/ranking, licence capture, labelling | 3, D3 | Uploads + stock first; generated illustrations later |
| **5 — Rendering** | Worker process, render queue, TTS/captions, thumbnails, progress notifications | 4, D1, D2, deployment of worker | Highest infra risk |
| **6 — Review & Approval** | Versioning, immutable approved snapshot, reject-with-reason, notifications | 3 (can run in parallel with 5) | |
| **7 — Publishing** | Connections (YouTube first), publish/retry/status; then Instagram | 5, 6, **external approvals (start in Phase 1)** | Submit Google/Meta reviews early — they gate delivery |
| **8 — Analytics & hardening** | Metrics sync, dashboards, retention passes, load/cost tests, pilot with NayanCare | 7 | |

Critical path: external verification (Google/Meta) and renderer choice. **Start those approvals during Phase 1.**

---

## 10. Test strategy and acceptance criteria

General: xUnit unit + integration (SQLite/TestHost, existing pattern); Jasmine specs per component/service (existing pattern, TestBed for tenant screens); contract check against `/swagger/v1/swagger.json`; **every new endpoint gets a cross-tenant 404 test and a role-denial test**; external APIs behind interfaces with fakes/sandboxes; CI must stay green.

| Phase | Key tests | Acceptance criteria |
|---|---|---|
| 1 | migration up/down; tenant filter on each new table; quota extension; signed-URL expiry; swagger diff | Tenant B cannot read/enumerate tenant A rows or files; no change to existing endpoints' contracts; existing 83 test files still pass |
| 2 | conditional-rule evaluation matrix; versioning; prefill; verify permission | A question hidden by a rule is never required/stored; changing a template version doesn't corrupt old responses; only Admin can verify a fact |
| 3 | schema-valid JSON from models (incl. malformed replies); claim-check; usage authorize/complete/fail refund | Every scene claim traces to a `Verified` fact or is flagged; provider failure refunds the credit; blocked tenants see the existing denial messages |
| 4 | matching ranking tests; licence-required rule; upload type/size/virus-scan hook; dedupe by checksum | No asset with unknown licence is selectable for publish; labels (Upload/Screenshot/Stock/Illustration) always present |
| 5 | renderer golden-file tests; worker crash/retry; cancel; concurrency caps; disk cleanup | Render completes ≤ agreed time for a 60-s video; API p95 unaffected during renders; failed render leaves no orphan files |
| 6 | state machine; hash immutability; audit entries | Edited content after approval forces re-approval; reject reason persisted; every transition audited |
| 7 | publish idempotency; token refresh/expiry; partial failure (upload ok, status poll fails); rate-cap; sandbox accounts | Never double-posts; unapproved/stale-hash content cannot be published even via direct API call; tokens never appear in responses or logs; failure is tenant-readable and retryable |
| 8 | metric sync fakes; retention job; load test; pilot UAT | Retention deletes expired assets and tokens; pilot tenant publishes end to end on both platforms |

---

## Blockers and decisions requiring approval

**Blockers**
- **B1** Google OAuth verification + YouTube API audit, and Meta App Review (+ possible Business Verification) have long external lead times; no publishing is possible without them.
- **B2** No rendering runtime exists; running it inside the API process is unsafe. A separate worker host (and its deployment story, since no containers are defined) must be approved.
- **B3** Multi-process workers require a **shared Data Protection key ring and shared storage**, both currently single-instance local.

**Decisions**
- **D1** Renderer: self-hosted FFmpeg worker vs. hosted render API.
- **D2** TTS/voice provider and languages (Hindi/English minimum for NayanCare?).
- **D3** Stock and illustration/image-generation providers; policy on AI-generated visuals.
- **D4** Metering: new `QuotaType`s (recommended) vs. reuse `AiConversations`; pricing in INR vs base USD.
- **D5** Storage: private bucket + signed URLs for Studio (recommended) vs. existing public bucket.
- **D6** Meta app: extend the existing WhatsApp/Ads app vs. a separate app for Instagram publishing.
- **D7** Real product screenshots: tenant upload only (recommended for MVP) vs. automated capture.
- **D8** Whether approval requires Admin only (recommended) or also SalesManager.
- **D9** Compliance posture for regulated industries (medical claims): mandatory fact verification + disclaimer rules, and who owns the rule data.
- **D10** Pilot scope: NayanCare as questionnaire/prompt/compliance **data** on the generic platform — confirm no tenant-specific code.

## Decisions recorded (owner, after Phase 0 review)

| ID | Decision | Design consequence |
|---|---|---|
| D1 | **Hosted render API** | `IVideoRenderer` has a hosted-vendor implementation only. No FFmpeg worker; B2 shrinks to a thin job that submits, polls/receives a webhook, and downloads the result. Webhook endpoint needs signature verification and a Studio `Webhook` rate policy. Vendor still to be named. |
| D2 | **Add a TTS provider** | `ITextToSpeech` interface + one provider, selected in platform settings. Vendor still to be named. |
| D3 | **Add stock + image-generation providers** | `IStockAssetProvider` / `IImageGenerator` interfaces, provider chosen in platform settings; generated images always labelled "illustration". Vendors still to be named. |
| D4 | **New quota types** | Add Studio `QuotaType`s (e.g. `ContentGenerations`, `VideoRenders`) to the existing ledger/plan quotas. |
| D5 | **Use the existing public bucket, configurable** | Studio storage zone (prefix, public vs signed-URL mode) is a platform setting, default = existing public bucket. Risk R9 stays open: drafts/uploads are publicly readable by URL, so keys must be unguessable (random ids) and the setting must allow switching to signed URLs later without a data migration. |
| D6 | **Extend the existing Meta app** | Add Instagram publishing permissions to the existing app; App Review now also touches the live WhatsApp/Ads app, so permission changes must not disturb current approvals. |
| D7 | **Tenant uploads screenshots** | No automated capture; screenshots are `StudioAsset` kind `Screenshot` via upload, with a consent attestation. |
| D8 | **Admin approves, configurable** | Per-tenant setting `ApprovalRole` (Admin-only default, switchable to include SalesManager); enforced server-side. Changes are audited. |

**Vendors locked in (owner, after cost review):** render = **Shotstack** (free watermarked sandbox for development), TTS = **Google Cloud TTS**, stock assets = **Pexels** with **Pixabay** as fallback, image generation = **OpenAI image API** (optional step).

**Phase 1 status (implemented on branch `feature/ai-content-studio-phase0-analysis` in both repos, uncommitted):** `QuotaType.ContentGenerations` / `VideoRenders`; `StudioActivity` + `TenantStudioSettings` tables (migration `AddContentStudioFoundation`, not yet applied to any database); `IStudioMeteringService` (charge / complete / refund / history, idempotent, over the shared quota ledger); per-tenant approval policy (`AdminOnly` default, switchable) and `StudioApprovalRules`; `ContentStudio:*` platform settings incl. storage mode (`PublicBucket` default / `SignedUrls`) and unguessable tenant-scoped storage keys; Admin-only `api/v1/content-studio` (overview, activity, settings); tenant screen **Content Studio → Charges & Activity**. Deferred to the phases that need them: project/scene/asset/render/publication tables, vendor API keys and clients, plan-editor fields for the new quotas.

*Per the completion gate, nothing beyond this analysis has been implemented. Awaiting explicit instruction and decisions above before Phase 1.*

---

## Delivery log (your numbering: 3 Content Planner, 4 Visual Intelligence, 5 Video Generation, 6 Review & Approval, 7 Social Publishing, 8 Analytics)

### Phase 3 - Content Planner (2026-10-27)
**Built.** `/content-studio/planner` (Admins and Sales Managers; hidden until the studio is on for the tenant): projects (title, goal, language) on the left, the chosen project on the right. **Topic ideas** are written by the platform AI from the tenant's *verified* business facts only (facts are numbered in the prompt; an idea that cites no fact is dropped). The tenant chooses one topic, then **a script** is written scene by scene (narration, on-screen text, seconds, what the picture shows, the facts cited). After every write and every edit the **application itself** checks each scene against the verified facts and marks it *backed*, *not verified yet*, *no fact behind it* or *needs no fact* (greetings, questions, invitations) - the AI's list of facts is only a pointer. Scenes can be reworded or removed while the script is a draft; **Check against my facts** re-runs the check (a fact may have been retired). A new script is a new version; earlier versions are kept. Each version stores a fingerprint of its words so the review phase can tell whether anything changed after approval.
**Charging.** One content generation per topic request and per script, taken before the AI is called and returned if the call fails, the reply is unusable, or the platform AI is in test mode (test-mode output is stored, labelled "Test data", and costs nothing).
**AI plumbing.** Two new tasks (`ContentTopicIdeas`, `ContentScript`) run through the existing task runner on the existing **Content generation** switch of the Integrations page (provider choice, Simulator/Api, fallback policy and the execution log all apply); they appear on the AI Providers screen under "Content Studio".
**Data.** Additive migration `AddContentStudioPlanner`: ContentProjects, ContentTopics, ContentVersions (unique number per project), ContentScenes. A version already has `Draft/InReview/Approved/Rejected` so Phase 6 adds no column.
**Tests.** API 2,280 passed (planner service, parser, claim rules, runner, controller guards); Angular 1,261 passed (12 new); build OK.
**Not verified.** No live AI provider (the model is scripted in tests, so how well a real model follows the JSON shape and the "cite a fact" rule is untested); no browser click-through; the sidenav entry has no spec because no shell spec switches the studio on.
**Limits to know.** The prompt wording is code (`PlannerPrompts`, versioned `planner-v1`), not yet editable by the platform operator. The claim check is word-and-number overlap, not understanding: it catches an invented figure or an unrelated sentence, not a subtle misstatement - which is why approval (Phase 6) stays a human decision. Scripts in a language other than English are checked against facts as written, so facts should be in the same language.
**Next (Phase 4 - Visual Intelligence).** Turn each scene's "what the picture shows" into assets: tenant uploads and screenshots, stock search, ranking, licence capture and labelling. Needs the stock provider key (Pexels) and a decision on image generation.

### Phase 4 - Visual Intelligence (2026-10-27)
**Built.** In the planner, every scene now has a **picture**: "Choose a picture" opens a picker in place with three tabs. **Your pictures** ranks the tenant's library for the scene by the words it shares with the scene's picture note (and says why); **Stock photos** searches Pexels with that note or the tenant's own words; **Upload** adds a JPEG/PNG/WebP (up to 10 MB) as "a picture or photo" or "a screenshot of my app or site". Uploads need the tenant's confirmation that they may use the picture and that anyone recognisable in it agreed; a screenshot also needs "no patient or customer personal data". The kind is always shown (*Your upload / Your screenshot / Stock photo (Pexels)*) with its licence and credit line; a scene shows how many scenes still have no picture.
**Rules enforced in code.** Files are judged by their first bytes, not their name (an .exe or SVG renamed .jpg is refused); the same file is kept once per tenant; files go to the tenant's own private folder and are shown through the API (never a storage link); a stock photo is copied only when chosen, and its licence, credit and image address come from Pexels' own record of that id - the browser sends only the id; the image is fetched from `images.pexels.com` over https only, without the API key, behind the same network guard as the website reader; no asset exists without stated terms; a picture can be set or removed only while the script is a draft; a picture used by a scene cannot be deleted; another tenant's scene or picture is "not found".
**Platform setting.** `ContentStudio:Stock:PexelsApiKey` (secret, Platform > Configuration). Without it the Stock tab says search is not set up and the tenant's own pictures still work.
**Data.** Additive migration `AddContentStudioAssets`: table `StudioAssets` (unique checksum per tenant) and `ContentScenes.ChosenAssetId`.
**Tests.** API 2,316 passed + 1 timing-sensitive rate-limit test that failed once under full-suite load and passed alone 3 of 3 (unrelated to this work); Angular 1,268 passed (7 new); build OK.
**Not verified.** No real Pexels call (the adapter is tested against a scripted HTTP handler, so Pexels' current response shape and rate limits are untested); no real S3 write of these pictures; no browser click-through of the picker.
**Deliberately left out / limits.** (1) Pixabay fallback, AI-generated illustrations and video clips - not built; a picture is not "understood", only matched on words, so the tenant makes the final choice. (2) Candidates are computed on request, not stored (the blueprint's `SceneAssetCandidate` table is not needed yet). (3) Searching stock costs nothing, so it is not logged as a studio charge. (4) Pictures are stored under the tenant's private S3 folder (`private/{tenant}/product-knowledge/studio/assets/…`) through the existing document store - the folder name says "product-knowledge" for historical reasons; Instagram's need for a public address is a Phase 7 concern. (5) The script's content fingerprint covers words only; Phase 6 should include each scene's chosen picture in what is approved. (6) Stock attribution is shown in the app; putting the credit line into the finished video is a Phase 5 decision.
**Next (Phase 5 - Video Generation).** Turn an approved-quality script and its pictures into a video: voice-over (Google Cloud TTS), scene timing, render (Shotstack), progress and cancellation, charged to the video-render quota. Needs the Shotstack and Google TTS keys and a decision on where the render output is stored.
