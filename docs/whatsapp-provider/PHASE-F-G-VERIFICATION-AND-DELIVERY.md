# QR-code WhatsApp bridge — Verification (Phase F) and Delivery (Phase G)

Status as of 2026-10-27. Branch `feature/whatsapp-provider-abstraction` in both repos. Analysis and decisions: [PHASE-A-C-ANALYSIS.md](PHASE-A-C-ANALYSIS.md).

**One-line status:** built, tested, connected live, and **one inbound message confirmed end to end**; **not yet cleared for production.** Outbound sends, delivery receipts and the disconnect pause have not been run live (the pilot needs a second phone), and the privacy/legal sign-off (R9) is open.

## 1. What was delivered

| Area | Delivered | Commit(s) |
|---|---|---|
| Provider-scoped message ids | `Message.Provider`; unique index `(Provider, WhatsAppMessageId)`; inbound dedup, status lookups and the inbound idempotency key all scoped by provider | API `a097599`, `5ce7291` |
| Provider selector | `GET/PUT /api/v1/platform/whatsapp-provider` (PlatformSuperAdmin, audited `previous -> new`). Bridge can only be activated once configured **and** reachable with the saved key | API `1af6d74`, `5ce7291` |
| Bridge settings | `GET/PUT /api/v1/platform/whatsapp-bridge-settings`: address, write-only key (masked), public webhook address, optional pilot tenants. Health-checked before saving; a bad save keeps the old settings | API `5ce7291` |
| Tenant QR channel | `TenantWhatsAppChannel` (migration `AddTenantWhatsAppChannels`): one bridge instance per tenant; instance token encrypted; webhook credentials stored only as hashes. Connect / status / disconnect / remove endpoints under `/api/v1/platform/tenants/{id}/whatsapp-bridge`, all audited | API `5ce7291` |
| Evolution adapter | `EvolutionApiClient` behind `IWhatsAppBridgeClient`; every call exercised against a running v2.3.7 | API `5ce7291` |
| Send routing | `WhatsAppServiceFactory`: bridge only when the active provider is QR **and** the tenant is in the pilot list (or the list is empty). A QR tenant whose channel is not Connected gets a failed send — never a Meta/simulated one. Templates are filled in locally and sent as text | API `5ce7291` |
| Webhook | `POST /api/v1/webhooks/whatsapp-bridge/{token}`: path token + secret header + the instance token in the body must all match; tenant comes only from the authenticated channel; only a secret-free canonical form is stored; groups, own messages, QR events and received-message read-state are dropped | API `5ce7291` |
| Safety | Unknown send outcomes (timeout, 5xx, dropped/unreadable reply) are never auto-retried (`WhatsAppSendResult.Ambiguous`); a provider switch is refused while sends are in flight; a 5-minute health job re-reads each channel from the bridge | API `5ec7415`, `ead2878` |
| Billing | Bridge sends count against quota as before but carry no Meta template charge (excluded from `WhatsAppSpendService`) | API `5ce7291` |
| UI | WhatsApp Provider page (selector + bridge settings); per-tenant QR card on the tenant page (QR shown in place, Connected only on the bridge's word, unconfirmed disconnect shown) | Angular `1fd0075`, `5cd337b`, `d08a4ac` |
| Dev bridge | Pinned `evoapicloud/evolution-api:v2.3.7` compose with Postgres + Redis in `deploy/evolution/` (key in a git-ignored `.env`) | API `c6e9bf3` |

Migrations: `ScopeMessageIdByProvider`, `AddTenantWhatsAppChannels` (both additive). The first migration's `Down` fails if two providers stored the same message id.

## 2. Verification results

| Check | Result |
|---|---|
| API tests | **2,249 passed, 0 failed** (SQLite in-memory + fakes) |
| Angular tests | **1,249 passed, 0 failed** (last full run); production (AOT) build clean |
| Bridge contract | Verified against a real Evolution v2.3.7 session with a real scan: create, QR, state, webhook set, text send, `connection.update` (`connecting`→`open`), `messages.upsert`, `messages.update` (`SERVER_ACK`/`DELIVERY_ACK`/`READ`), logout/delete behaviour |
| Migrations on SQL Server | `ScopeMessageIdByProvider` and `AddTenantWhatsAppChannels` applied by the API's startup `MigrateAsync` on the local SQL Server; the channel table is in use by the live connect below |
| Live: bridge settings, QR connect, status | **Done by the operator:** settings saved with the key check, QR shown in the tenant card, scanned, card turned **Connected** with the linked number |
| Live: database | **Checked 2026-10-27 (read-only):** both migrations applied; `Messages.Provider` present; scoped unique index present and the old global index gone; one `TenantWhatsAppChannels` row, status Connected |
| Live: inbound message | **One real inbound message** was stored with `Provider = QrBridge`, Delivered, with a provider message id (created after the QR connect) - so the real bridge -> authenticated webhook -> inbound processor -> database path ran at least once. Not established: who sent it, whether the AI replied, or any outbound/receipt behaviour |
| Tenant isolation | Tested: a webhook's tenant comes only from the authenticated channel; another tenant's secret cannot open a channel; payload-claimed instance/tenant ignored; per-tenant instance names; pilot list keeps other tenants on Meta |
| Duplicate protection | Tested: redelivered message recorded once; same id on two providers = two messages; status never moves backwards (observed out-of-order acks); unknown-outcome send never retried |
| Meta remains usable | Existing 2,100+ tests (campaigns, consent, billing, webhooks) still pass unchanged; Meta is the default and what a non-pilot tenant uses |

### Not verified (do not assume)
- **Live outbound sends and delivery/read receipts through the finished adapter.** Needs a second phone. The earlier probe captured these payloads, and unit tests use those shapes, but the outbound path with the real adapter has not been exercised. **Inbound has now been seen live once** (see the table above); repeated inbound, the AI reply to it and the duplicate-delivery case are still only unit-tested.
- Whether the live connect's "Connected" arrived via the webhook or the page's polling (the API in use then was not one whose log I could read). Either is a real bridge signal.
- An **unexpected disconnect** event (`close`) — mapped by convention, never captured.
- Media, groups, message history, reply/quote on the bridge — unsupported and untested.
- The health job and the provider-switch guard against a real database/bridge (unit-tested only).
- Load, long-run stability, Evolution restart behaviour, and multi-tenant concurrency on one bridge.
- Behind a TLS reverse proxy (dev used a Development-only HTTP exemption for the webhook route).

## 3. Configuration steps
1. Deploy the bridge (section 4), set a strong `EVOLUTION_API_KEY`.
2. Platform console → **WhatsApp Provider** → *QR bridge connection*: bridge address, key, this API's **public https** address, and **the pilot tenant id**. Save (the bridge must answer).
3. Platform → Tenants → the pilot tenant → *WhatsApp QR connection* → **Connect with QR code**; scan with the tenant's dedicated number (WhatsApp → Linked devices). Wait for **Connected**.
4. *Then* select **QR-Code WhatsApp Bridge** on the provider page and save. With a pilot list set, only listed tenants use it.
5. Pilot: one inbound message, one reply, check ticks; Disconnect and confirm sends pause; reconnect.
6. Platform-wide only after the pilot passes **and** the go/no-go items below are closed: clear the pilot list.

## 4. Deployment notes
- Apply migrations (the API does this at start-up). Bridge: Evolution v2.3.7 + PostgreSQL + Redis; persist the instances volume; back up the Postgres volume (it holds the linked sessions).
- **Never expose Evolution's port or `/manager` publicly.** Only this API needs to reach it; only the bridge needs to reach the webhook route. Put the webhook behind HTTPS.
- Do **not** carry the Development-only HTTP exemption into any other environment (`Program.cs` limits it to Development).
- The bridge key is a master key: store it as a secret, rotate if exposed (a dev key was printed once and was rotated).
- Run the platform API in only one place for the pilot, so the health job and webhook logs are in one place.

## 5. Rollback
- **Switch back:** WhatsApp Provider → select Meta → Save. Refused while sends are in flight (wait a few minutes). No Meta data was ever touched, so Meta resumes immediately.
- **Per tenant:** QR card → Remove (confirms the disconnect before deleting; if unconfirmed, remove the linked device on the phone, then retry).
- **Emergency:** clear the bridge address/key (the bridge option becomes unselectable) — but this does not by itself change the active provider; switch to Meta first.
- **Schema:** migrations are additive; leave them in place. `ScopeMessageIdByProvider.Down` fails if cross-provider duplicate ids exist.

## 6. Known limitations
- Text only on the bridge; campaign templates are rendered locally and sent as text. No media, no template approval, no 24-hour-window logic specific to the bridge.
- Ambiguous sends are parked for a person to check; there is no automatic reconciliation against the bridge's message history.
- Provider switching is a guard (refuse while in flight), not a drain/rollback state machine; the pilot list is the intended safety.
- `logout`/`delete` replies are not trusted (see Phase A–C §9.2); a disconnect can end "unconfirmed", needing the linked device removed on the phone.
- QR is a 45-second code observed from the bridge, not a documented guarantee.
- Delivery status is matched by `keyId` only; read receipts depend on the recipient's privacy settings.

## 7. Risk status and go / no-go (production)
| # | Risk | Status |
|---|---|---|
| R1 | Unofficial protocol: number bans / ToS | **Accepted for a single-tenant pilot on a dedicated number only.** Production = **no-go** without explicit business sign-off |
| R9 | The bridge stores the linked phone's chats/contacts (4,353 messages / 1,257 contacts in a 15-minute probe) | **Open.** Production = **no-go** until legal/privacy sign-off, a retention/deletion procedure and verified deletion on channel removal |
| R3/R4 | Session-token theft; cross-tenant leak | Mitigated (encryption, hashes, per-tenant instance, authenticated webhook, tests); needs the deployment hardening in section 4 |
| R5 | Duplicate sends on reconnect/switch | Mitigated (no retry of unknown outcomes, switch guard); not load-tested |
| R2 | Bridge breaks on a WhatsApp protocol change | Open by nature; health job + Meta fallback by explicit switch only |

## 8. Suggested next work
1. Run the live outbound/receipt pilot (second phone), confirm the AI reply to an inbound message, test Disconnect pausing sends, and capture an unexpected-disconnect event; update section 2.
2. Resolve R9 (privacy review, retention, deletion check) before any wider use.
3. If the bridge becomes more than a pilot: a real drain/rollback state machine, reconciliation of unknown outcomes against the bridge, tenant notifications on disconnect, media.
