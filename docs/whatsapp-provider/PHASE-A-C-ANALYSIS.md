# Configurable WhatsApp Provider — Phases A–C (Discovery, Analysis, Design Review)

Status: **DRAFT FOR APPROVAL. No code has been changed.** Branch `feature/whatsapp-provider-abstraction` exists in both repos (cut from local `main` in the Angular repo and local `master` in the API repo; neither repo has `origin/HEAD` set, so "default branch" was taken as those).

Legend: **[V]** verified in the repo; **[U]** not yet verified / assumption; **[P]** proposed.

---

## 1. Phase A — What exists today (Deliverable 1)

### 1.1 Stack [V]
- API: .NET 8, Clean Architecture (`Domain` / `Application` / `Infrastructure` / `Api`), EF Core migrations, Hangfire, Serilog, xUnit tests (`tests/WhatsAppSalesAutomation.Tests`, ~126 files reference WhatsApp).
- Frontend: Angular 15; platform console lazy module at `/platform`.

### 1.2 A provider abstraction already exists — this is the most important finding [V]
The brief assumes Meta calls are scattered. They are not:

| Piece | File | Role |
|---|---|---|
| `IWhatsAppService` | `Application/Common/Interfaces/IWhatsAppService.cs` | Contract used by every consumer: `SendTemplateMessageAsync`, `SendTextMessageAsync`, `UploadMediaAsync`, `GetMessageTemplatesAsync`, `Create/UpdateMessageTemplateAsync` |
| `WhatsAppServiceFactory` | `Infrastructure/WhatsApp/WhatsAppServiceFactory.cs` | The registered `IWhatsAppService`. Per call: tenant has credentials → `MetaWhatsAppCloudApiClient`, else → `SimulatedWhatsAppClient` |
| `MetaWhatsAppCloudApiClient` | `Infrastructure/WhatsApp/` | Only place with Graph API URLs/payloads (plus `TenantWhatsAppTokenRefreshService`, `MetaEmbeddedSignupService`, `TenantWhatsAppConnectionVerifier`, `PlatformWhatsAppSender/Verifier`, `MetaAdsClient`) |
| `IWhatsAppWebhookParser` / `WhatsAppWebhookParser` | Application iface, Infra impl | Meta JSON → `InboundWhatsAppMessage` / `WhatsAppStatusUpdate` / `WhatsAppQualityUpdate` |
| `IWebhookSignatureValidator` | Infra | HMAC `X-Hub-Signature-256` |

Consumers of `IWhatsAppService`: `CampaignSendService`, `ConversationService`, `ConversationOrchestrator`, `LeadFollowUpService`, `MessageTemplateService`, `MessageTemplateSyncJob`, `TenantNotifier`, `ConsentWhatsAppStarter`, onboarding/platform services.

**Consequence:** a bridge is a new *adapter* behind the existing seam, not a rewrite. Campaign and AI services need no change if the contract stays compatible.

### 1.3 Meta-coupled leaks above the seam (the real work) [V unless noted]
1. **`WhatsAppSendResult.WhatsAppMessageId`, `Message.WhatsAppMessageId`** — column name and global-uniqueness assumption ("Meta's own id, globally unique") used for status and inbound dedup in `InboundWebhookProcessor` (~l.165, 219–222). Bridge IDs are not guaranteed globally unique → needs `(Provider, ChannelId, ProviderMessageId)` scoping. **[V]**
2. **Templates.** Campaign pipeline is "always business-initiated, always template" (`SendTemplateMessageAsync` doc). Template CRUD/sync is Meta review-status specific (`WhatsAppTemplateStatus`, `MetaTemplateId`). A QR bridge has no template approval concept. **[V]** (bridge side: see §2.)
3. **24-hour customer-service window** enforced in `ConversationService` — a Meta rule; a bridge has no such window but has its own ban heuristics.
4. **Webhook endpoint** `POST /api/v1/webhooks/whatsapp` is Meta-specific end to end: parses Meta JSON, routes tenant by `metadata.phone_number_id`, verifies HMAC with that tenant's `AppSecret`, records the raw event, enqueues `InboundWebhookProcessingJob`. Anonymous + rate limited. **[V]**
5. **Quality ratings** (`WhatsAppQualityRating`, `ITenantQualityService`) — Meta-only concept.
6. **Spend** (`WhatsAppSpendService`, `WhatsAppPricingOptions`) prices *template sends by category per country* on read. A bridge has no Meta category charge. **[V]**
7. **Frontend:** `whatsapp-connection-form`, `tenant-settings-list`, `platform-whatsapp-settings`, `platform-whatsapp-connections`, `consent-page-settings` are Meta-shaped. **[V]**

### 1.4 Provider selection today [V]
- `WhatsApp:Provider` ("Simulated" | "Meta") exists in `AppSettingCatalog` and `WhatsAppSettings.Provider`, flagged "restart required". **However the factory does not read it** — selection is purely "does this tenant have credentials". So today's "provider" setting is effectively vestigial/misleading. **[V from the factory and DI comments; the DI body for the key's remaining consumers is [U]]**
- Platform settings are DB-backed (`AppSetting` + `AppSettingCatalog`, secrets encrypted by `AppSettingsSecretProtection`), editable only by `PlatformSuperAdmin` through `PlatformWhatsAppSettingsController`. **[V]**

### 1.5 Tenancy [V]
- **Tenant-specific WhatsApp credentials already exist:** `TenantWhatsAppConfig` is 1:1 with Tenant (PhoneNumberId, WABA id, encrypted AccessToken/AppSecret, verification state, quality state). Per memory notes and the controller comment, ownership is `PlatformSuperAdmin` only (`PlatformTenantConfigController`).
- All tenants share **one platform Meta App** and one webhook URL; tenant is resolved from `phone_number_id`, then the signature is checked with that tenant's secret.
- Tenant isolation: EF global query filter via `ITenantOwned`; `GetByPhoneNumberIdAsync` is the single deliberate `IgnoreQueryFilters()`.
- So the brief's §4.4 warning is real: **a global provider switch does not mean one shared WhatsApp session.** A QR session is one phone number = one tenant.

### 1.6 Campaign / billing [partly V]
- `CampaignSendService`: consent gate (`OptInStatus`), idempotency key `{campaignCustomerId}:step{n}` **reserved before** the external call, quota consume (`IQuotaGate.TryConsumeWhatsAppTemplateAsync`) with `ReleaseAsync` on failure, retry path with a re-check of consent. **[V]** This is the existing ambiguous-outcome machinery.
- Billing is a credit wallet (`CreditWallet`, `PlatformWalletService`) plus quota gate. I have **not** yet read the ledger/refund rules in detail. **[U]**
- Existing tests to extend: `CampaignSendQuotaTests`, `CampaignStepDeliveryTests`, `CampaignJourneyTests`, `ConsentFlowTests`, `CreditWalletTests`. **[V]**
- Audit trail, Hangfire retry/dead-letter policy, and monitoring details: **[U]** — to be inspected in Phase D mapping. `AuditTrailTests` exists.

### 1.7 Technical debt relevant here
- Vestigial `WhatsApp:Provider` flag (above).
- `WhatsAppMessageId` naming and global-uniqueness assumption.
- `IWhatsAppService` doc/semantics mix "template-only campaigns" with Meta review mechanics.

---

## 2. Bridge provider — documentation review (Phase B input)

**Honest status: I have not yet verified a specific bridge's API.** The brief says the fields "must be derived from the chosen bridge provider's actual documentation", and **no provider has been chosen.** A quick web search only returned secondary/vendor material, no primary docs, so I am not putting endpoint names, statuses or webhook formats into this spec.

What the search did consistently say (secondary sources, *not* authoritative):
- QR-based bridges (Evolution API, WAHA, Baileys-based) use an **unofficial WhatsApp Web / linked-device protocol**, are described as violating WhatsApp's Terms, carry real number-ban risk, and can break whenever WhatsApp changes the protocol. Sources: [Evolution API vs Cloud API](https://pasqualepillitteri.it/en/news/12969/integrate-whatsapp-evolution-api-vs-cloud-api), [WhatsApp API vs. Unofficial Tools](https://www.bot.space/blog/whatsapp-api-vs-unofficial-tools-a-complete-risk-reward-analysis-for-2025).
- Cloud API is the compliant route but needs business verification and template approval.

Per brief §10, if the chosen bridge is unofficial this is a **production-readiness blocker requiring explicit business and security sign-off.** My expectation is that every QR bridge falls in that class.

### 2.1 Capability matrix (provisional; bridge column intentionally unfilled)
| Capability | Meta Cloud API (repo-verified) | QR bridge |
|---|---|---|
| Free-form text | Only inside 24h window | **TBD per provider docs** |
| Template send | Yes, requires approval | Likely N/A — **TBD** |
| Template create/sync | Yes (`Create/Update/GetMessageTemplates`) | Likely N/A — **TBD** |
| Media | Upload → media id | **TBD** |
| Delivery/read statuses | Webhook `sent/delivered/read/failed` | **TBD** |
| Inbound messages | Webhook | **TBD** |
| Webhook auth | HMAC-SHA256 with tenant App Secret | **TBD** (often a static header/apikey) |
| Health check | Phone-number read (`TenantWhatsAppConnectionVerifier`) | **TBD** |
| Quality rating | Yes | No |
| Official / ToS-compliant | Yes | **Almost certainly no** |

---

## 3. Phase B — Business Requirements (Deliverable 2, condensed)

**Objective:** make messaging provider-independent; platform admin chooses the provider; existing workflows, wallet, consent and AI untouched.

**In scope:** provider selector + config + validation + audit; bridge adapter behind `IWhatsAppService`; QR connect/status/disconnect UI; normalized inbound/status events; provider-scoped message IDs; explicit switch state machine; tests.
**Out of scope (needs separate approval):** tenant-level provider override; automatic Meta fallback; migrating QR sessions to Cloud API; removing Meta.

**Business rules**
- BR1 Consent/DND/opt-out gates apply identically to both providers.
- BR2 No silent fallback between providers. Ever.
- BR3 One wallet; provider switch never touches balances.
- BR4 Connected status only after provider-confirmed state.
- BR5 Invalid config never replaces a working one.
- BR6 Meta stays selectable.
- BR7 Secrets never in logs, DTOs or browser state; masked on read.

**Success criteria:** the 16 acceptance criteria in the brief, plus a one-tenant pilot before platform-wide enablement.

## 4. Phase B — Functional requirements (Deliverable 3, headline IDs)

| ID | Requirement | Key acceptance |
|---|---|---|
| FR-01 | Platform admin selects active provider (Meta / QR Bridge) in `/platform` | Shows current provider + status; save reports applied/failed |
| FR-02 | Provider config form shows only that provider's fields; secrets masked | No secret in any GET response |
| FR-03 | Pre-save validation (required, URL, health check if documented) | Failure leaves previous active config intact |
| FR-04 | Audit: actor, time, previous/new config reference (no secrets) | Row in existing audit log |
| FR-05 | QR connect: initiate → QR + expiry → refresh/cancel | QR not logged/cached beyond lifetime |
| FR-06 | Status model: NotConnected, ConnectionInitiated, QrAvailable, AwaitingAuthentication, Connected, Disconnected, Reconnecting, ConnectionFailed, Disabled | Mapped from provider-reported state only |
| FR-07 | Disconnect / reconnect / health monitor | Reconnect never re-sends already-accepted messages |
| FR-08 | Dispatch resolves provider at dispatch boundary; gates: config, health, consent, wallet | Disconnected ⇒ pause, not reroute |
| FR-09 | Webhook: authenticate, normalize, resolve tenant from trusted id, dedupe, persist, async process | Duplicate event ⇒ no second AI reply or debit |
| FR-10 | Provider-scoped message identity | Same provider id on two providers/channels cannot collide |
| FR-11 | Switch state machine (below) | Fail ⇒ roll back to previous |

**Switch state machine [P]:** `Active(Meta)` → `Draft(new)` → `Validating` → `Draining` (stop new dispatch for tenants; wait until no `Sending`/ambiguous messages and reconcile) → `Activating` → `Active(new)`; any failure → `RolledBack(previous)`. Applies to **newly started sends only**; queued items hold until drained; in-flight ambiguous ones must reconcile first (brief §11).

User stories (Deliverable 4) follow the brief's 12 topics and will be written in Given/When/Then once decisions in §6 are closed — they depend on the chosen bridge's real status/webhook semantics.

---

## 5. Phase B — Architecture sketch and risks (Deliverables 5, 8 headline)

**Design [P]:**
1. Keep `IWhatsAppService` as the seam. Add `IWhatsAppProviderAdapter` + `IProviderResolver` inside Infrastructure; `WhatsAppServiceFactory` resolves `(platform provider) × (tenant channel)` instead of "has credentials?".
2. New data (additive migrations): `WhatsAppProviderSettings` (platform active provider + state), `TenantWhatsAppChannel` (tenant, provider, status, encrypted bridge session/instance ref, last health), provider config-version history for audit/rollback. Add `Provider` + `ChannelId` to `Messages` and replace the global unique index on `WhatsAppMessageId` with a scoped one. Reuse `TenantWhatsAppConfig` for Meta untouched.
3. Webhooks: keep the Meta endpoint byte-for-byte; add a **separate** bridge endpoint (`/api/v1/webhooks/whatsapp-bridge/{channelToken}`) — different auth and schema. Both write the existing `WebhookEvent` record and feed one normalized processor.
4. Ambiguous sends: reuse the existing idempotency-key-before-call pattern; bridge timeouts mark the message `Unknown` and reconcile via status lookup if the bridge supports it **[U]**; otherwise manual review.
5. Billing: bridge sends consume the same quota/credit gate; a distinct cost class is needed since Meta category pricing does not apply **(decision D5)**.

**Risk register (top items)**
| # | Risk | Sev | Likelihood | Mitigation | Go/No-go |
|---|---|---|---|---|---|
| R1 | Unofficial protocol → number bans, ToS violation | Critical | High | Dedicated pilot number, consent-only, rate caps, explicit business sign-off | **No-go until signed off** |
| R2 | Bridge breaks on WhatsApp protocol change | High | Medium | Health checks, kill switch, Meta remains selectable | Required |
| R3 | Session token theft = full account takeover | Critical | Low–Med | Encrypt with existing secret protection, never log, platform-admin only | Required |
| R4 | Cross-tenant leak via shared bridge instance | Critical | Low | One instance/session per tenant, channel token in webhook path, isolation tests | Required |
| R5 | Duplicate sends on reconnect/switch | High | Medium | Idempotency key, drain-before-switch, no auto retry on ambiguous | Required |
| R6 | Unsolicited bulk messaging via bridge bypassing templates | High | Medium | Same consent gates, per-channel send-rate cap | Required |
| R7 | Global `WhatsAppMessageId` uniqueness breaks | High | Certain without change | Scoped unique index migration | Required |
| R8 | Wallet debited for messages never sent | Medium | Medium | Existing consume/release pattern | Required |

---

## 6. Phase C — Decisions needed before implementation (blocking)

I'm asking only what changes the design.

- **D1. Which bridge?** (Evolution API, WAHA, Baileys-based custom, a hosted vendor.) Unlocks real endpoint/status/webhook mapping. Until chosen, FR-05–FR-09 stay provisional.
- **D2. Is the unofficial-protocol risk (R1) accepted for pilot?** If no, the QR bridge cannot proceed and the right answer is fixing the Meta onboarding instead.
- **D3. Scope of the selector.** The brief says platform-wide, but §1.5 shows each tenant already owns a number. Recommended: platform selects which provider is *offered*, and each tenant has its own channel; QR tenants must scan their own number. Confirm that "platform-wide" means this, not "every tenant on one shared QR number".
- **D4. Failure policy** when the bridge is down: pause and alert (recommended) vs. queue with expiry.
- **D5. Billing for bridge sends:** same credit price as Meta template category, a flat bridge price, or free? Affects `WhatsAppSpendService`.
- **D6. Templates on the bridge:** hide template sync for bridge tenants and send rendered text, or require templates anyway? Affects consent-invitation and campaign flows.
- **D7. Hosting** of the bridge (self-hosted on your infra vs vendor-hosted) — drives secrets, data retention and availability answers.

### Decisions recorded (2026-10-26)
- D1 Evolution API (self-hosted; exact endpoints to be verified against official docs before adapter work).
- D2 Unofficial-protocol/ban risk **accepted for a single-tenant pilot only**, dedicated number, consented contacts only.
- D3 Platform offers the provider; each tenant has its own channel/number. D4 Pause and alert when disconnected.
- D5 No per-message charge for bridge sends; plan quota still counts (configurable). D6 Free-form text and locally rendered templates sent as text. D7 Self-hosted.
- Implementation plan (§7) **not yet approved**.

## 7. Proposed implementation order (Phase D preview, not started)
1. Scoped message identity migration + normalized event contract (no behavior change, Meta only) — gate: existing tests green.
2. Provider settings entity, resolver, audit, platform API + `/platform` screen (Meta only selectable) — gate: switching is a no-op.
3. Bridge adapter + channel entity + QR endpoints + bridge webhook (flagged off).
4. Switch state machine + drain/rollback.
5. One test tenant on the bridge; soak; then decision on wider rollout.

Rollback at each step: additive migrations, feature flag off, Meta remains default.

## 8. Not yet verified (so I don't overstate)
- Wallet/ledger refund details, Hangfire retry/dead-letter configuration, exact audit-log schema, `ConversationService` window logic, the remaining consumers of `WhatsApp:Provider`.
- Any bridge's API. No tests have been run in this phase.

---

## 9. Evolution API v2.3.7 — contract verified against a running server (2026-10-27)

Method: pinned `evoapicloud/evolution-api:v2.3.7` (compose in the API repo, `deploy/evolution/`), called it directly. The server serves no Swagger, so everything below is observed behaviour. **Auth:** every call needs header `apikey: <global key>`; no key → 401.

| Capability | Verified call | Observed |
|---|---|---|
| Create + start pairing | `POST /instance/create` `{instanceName, integration:"WHATSAPP-BAILEYS", qrcode:true}` | 200; `instance.{instanceId,status:"connecting"}`, `hash` (per-instance token), `qrcode.{base64 (data-URI PNG), code, pairingCode:null, count}` |
| Re-fetch QR | `GET /instance/connect/{instance}` | 200; `{pairingCode, code, base64}` |
| Status | `GET /instance/connectionState/{instance}` | `{instance:{instanceName,state:"connecting"}}` |
| Detail | `GET /instance/fetchInstances?instanceName=` | `connectionStatus`, `ownerJid`, `profileName`, `number`, `disconnectionReasonCode`, `disconnectionAt` |
| Webhook per instance | `POST /webhook/set/{instance}` `{webhook:{enabled,url,byEvents,base64,headers{},events[]}}` | 200; read back with `GET /webhook/find/{instance}`. **Custom `headers` are supported → we can send a per-channel secret header for authenticity.** |
| Disconnect | `DELETE /instance/logout/{instance}` | `{status:"SUCCESS",...}` |
| Remove | `DELETE /instance/delete/{instance}` | `{status:"SUCCESS",...}` |
| Send text | `POST /message/sendText/{instance}` | Body is **flat** `{number, text}`; the nested `textMessage` form is **rejected** (400 `requires property "text"`). Response shape (message id) **NOT verified** — needs a connected session. |

**Not verified yet (needs a phone to scan):** the `connecting → open` transition and its `CONNECTION_UPDATE` payload; `QRCODE_UPDATED` payload (QR rotates; `count` field suggests a limit); the sendText success response and where the message id is; `MESSAGES_UPSERT` (inbound), `MESSAGES_UPDATE` (delivery/read) and `SEND_MESSAGE` payloads; behaviour on unexpected disconnect.

**Design consequences already clear**
- Webhook authenticity = per-channel secret header we set via `webhook.headers`, plus a per-channel unguessable path segment. No HMAC is offered, so this is weaker than Meta's signature (R3/R4 stay as-is).
- Instance name = `t-{tenantId-without-dashes}` (one instance per tenant; never reuse across tenants). The instance `hash`/token is stored encrypted and never logged.
- The QR `base64` is temporary authentication material: returned to the UI, never persisted or logged.
- Template sends on the bridge render the template locally and call sendText (D6).
