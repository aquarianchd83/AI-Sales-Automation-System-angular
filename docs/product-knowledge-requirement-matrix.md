# Product Knowledge Engine — Requirement Traceability Matrix

Source: `peomot.txt` (master prompt). Design: [PRODUCT-KNOWLEDGE-ENGINE-PROPOSAL.md](PRODUCT-KNOWLEDGE-ENGINE-PROPOSAL.md).
Updated after every phase. **A row is COMPLETE AND VERIFIED only when code, tests and acceptance criteria are all satisfied and the test actually ran.**

**Status values:** COMPLETE AND VERIFIED · IMPLEMENTED BUT NOT FULLY VERIFIED · PARTIALLY IMPLEMENTED · BLOCKED · NOT IMPLEMENTED · NOT APPLICABLE WITH JUSTIFICATION.
**Baseline classes** (before any work): EXISTS = already implemented, MODIFY = existing, needs change, NEW = new implementation.

**Owner decisions recorded (2026-10-19):** all P1–P12 and D1–D9 recommendations accepted, with these specifics — Draft/Final output is a **plain text file, not a PDF** (§11 amended); scanned documents are read by the **selected AI provider's vision behind an Integrations toggle (default OFF)**, not an OCR library; PDF text extraction uses **PdfPig** (already referenced); AI cost is borne by the platform admin (tenants are not charged), with a configurable maximum document size; provider keys are entered by the owner and **live verification is done by the owner** (this work provides the on/off, verify and status controls); the application is in development mode, so chat cut-over is gated by a per-tenant switch.

**Phase key:** P0 analysis · P1 integration foundation · P2 source ingestion · P3 drafting & evidence · P4 verification UX · P5 versions & publish · P6 knowledge files · P7 chat serving · P8 downstream & hardening · P9 final audit.

| Legend | Meaning |
|---|---|
| Result | The actual test result. `—` until run. Never filled in from expectation. |

---

## §1 Discovery and deliverables

| ID | Requirement | Baseline | Phase | Validation | Result | Status |
|---|---|---|---|---|---|---|
| PK-1.1 | Repository architecture summary | NEW | P0 | Proposal §2 | Written 2026-10-19 | COMPLETE AND VERIFIED |
| PK-1.2 | Existing functionality inventory | NEW | P0 | Proposal §2 | Written; two items flagged "re-verify before P7" | PARTIALLY IMPLEMENTED |
| PK-1.3 | Gap analysis | NEW | P0 | Proposal §11 | Written | COMPLETE AND VERIFIED |
| PK-1.4 | Requirement traceability matrix (this file) | NEW | P0 | File exists, kept current | Created | PARTIALLY IMPLEMENTED (rows updated per phase) |
| PK-1.5 | Implementation plan | NEW | P0 | Proposal §9 | Approved by owner | COMPLETE AND VERIFIED |
| PK-1.6 | Affected projects/files/APIs/DB/UI listed | NEW | P0–P9 | Per-phase notes below | — | PARTIALLY IMPLEMENTED |

## §2 Minimise tenant effort

| ID | Requirement | Baseline | Phase | Validation | Result | Status |
|---|---|---|---|---|---|---|
| PK-2.1 | Search sources before asking questions | NEW | P3 | Service test: question with supporting passage is drafted, not asked | — | NOT IMPLEMENTED |
| PK-2.2 | Generate suggested answers where evidence exists | NEW | P3 | Same | — | NOT IMPLEMENTED |
| PK-2.3 | Tenant confirms or corrects | NEW | P4 | Spec: confirm/edit actions | — | NOT IMPLEMENTED |
| PK-2.4 | Ask only when missing/unclear/contradictory/needs approval | NEW (readiness gaps exist for facts) | P3–P4 | Test: only unresolved items surface | — | NOT IMPLEMENTED |
| PK-2.5 | Prefer yes/no, multiple choice, short inputs | MODIFY (questionnaire supports) | P4 | Spec | — | NOT IMPLEMENTED |
| PK-2.6 | Save progress and resume | EXISTS (questionnaire autosave) → extend | P4 | Spec | — | NOT IMPLEMENTED |
| PK-2.7 | Optional questions never forced | EXISTS pattern | P4 | Test | — | NOT IMPLEMENTED |
| PK-2.8 | Show unresolved items clearly | NEW | P4 | Spec | — | NOT IMPLEMENTED |

## §3 Source ingestion

| ID | Requirement | Baseline | Phase | Validation | Result | Status |
|---|---|---|---|---|---|---|
| PK-3.1.1 | Upload brochures, PDFs, manuals, feature/pricing docs, FAQs | MODIFY (upload → draft article exists) | P2 | Test per format | — | NOT IMPLEMENTED |
| PK-3.1.2 | File type and size validation (size limit configurable by admin) | MODIFY | P2 | Tests: wrong type, oversize | — | NOT IMPLEMENTED |
| PK-3.1.3 | Access authorisation, tenant-owned sources | MODIFY | P2 | Cross-tenant test | — | NOT IMPLEMENTED |
| PK-3.1.4 | Secure storage | EXISTS (`IMediaStorageService`) | P2 | Test | — | NOT IMPLEMENTED |
| PK-3.1.5 | Processing status, error reporting, retry | NEW | P2 | Tests | — | NOT IMPLEMENTED |
| PK-3.1.6 | Duplicate detection | NEW | P2 | Test: same hash | — | NOT IMPLEMENTED |
| PK-3.1.7 | Scanned/image PDFs read via AI vision (Integrations toggle, default OFF); unreadable never marked processed | MODIFY (scanned currently rejected) | P1 toggle · P2 flow | Tests incl. toggle off → clear rejection | Scanned pages are now their own task group on Integrations ("Reading scanned pages and images": Off / Simulator / tool, default Off); runner refuses with FEATURE_OFF while Off (test). Upload flow that uses it is P2 | PARTIALLY IMPLEMENTED |
| PK-3.1.8 | Page-level references from PDFs (PdfPig) | MODIFY (markdown only today) | P2 | Test: page numbers kept | — | NOT IMPLEMENTED |
| PK-3.2.1 | Validate website URL | NEW | P2 | Tests | — | NOT IMPLEMENTED |
| PK-3.2.2 | Scan relevant public pages in an approved scope | NEW | P2 | Tests | — | NOT IMPLEMENTED |
| PK-3.2.3 | Extract products, features, benefits, pricing, use cases, FAQs, business info | NEW | P2–P3 | Tests | — | NOT IMPLEMENTED |
| PK-3.2.4 | Record source URL and extraction timestamp | NEW | P2 | Test | — | NOT IMPLEMENTED |
| PK-3.2.5 | Identify duplicate content | NEW | P2 | Test | — | NOT IMPLEMENTED |
| PK-3.2.6 | Report inaccessible/failed pages | NEW | P2 | Test | — | NOT IMPLEMENTED |
| PK-3.2.7 | Preserve source references for facts | NEW | P2–P3 | Test | — | NOT IMPLEMENTED |
| PK-3.2.8 | Respect access restrictions and crawling policy (robots.txt) | NEW | P2 | Test | — | NOT IMPLEMENTED |
| PK-3.2.9 | SSRF / unsafe redirect / private network protection | NEW (media fetcher pattern exists) | P2 | SSRF payload tests | — | NOT IMPLEMENTED |
| PK-3.2.10 | More than the homepage is scanned; no bypass of access controls | NEW | P2 | Test | — | NOT IMPLEMENTED |
| PK-3.3.1 | Multiple documents and sites per tenant | NEW | P2 | Test | — | NOT IMPLEMENTED |
| PK-3.3.2 | One consolidated structured model, source link preserved | NEW | P3 | Test | — | NOT IMPLEMENTED |

## §4 AI providers and simulator (Platform Admin → Integrations)

| ID | Requirement | Baseline | Phase | Validation | Result | Status |
|---|---|---|---|---|---|---|
| PK-4.1.1 | All provider/simulator config in Platform Admin → Integrations | MODIFY (per-feature engine choice already on Integrations; keys/enable/model on Configuration) | P1 | Spec + API tests | Provider config (On/Off, key, model, prices, Verify, accuracy test, capabilities, comparison) stays on the existing Configuration → AI Providers screen - one place, no duplicate; feature-level items (Product knowledge engine choice, AI policy, AI call log) on Platform → Integrations. settings-list + platform-ai-policy specs pass | IMPLEMENTED BUT NOT FULLY VERIFIED |
| PK-4.1.2 | Extend the existing module, no separate tenant screens | EXISTS pattern | P1 | Review | Extends the existing Configuration → AI Providers and Integrations pages and feature-routing; no new provider screen, no tenant screen | COMPLETE AND VERIFIED |
| PK-4.2.1 | Simulator, ChatGPT, Gemini, Claude all represented | MODIFY (clients exist) | P1 | Tests | ChatGPT + Claude + Gemini adapters; Simulator is the engine choice on Integrations (as for every AI feature); AiTaskRunnerTests / PlatformAiProvidersServiceTests (mocked HTTP) pass. **No live call made by me** — owner verifies with own keys | IMPLEMENTED BUT NOT FULLY VERIFIED |
| PK-4.2.2 | Simulator available for dev/testing/demo | EXISTS → scenarios NEW | P1 | Tests | Simulator scenarios selectable on the page; tests pass | COMPLETE AND VERIFIED |
| PK-4.3.1 | Enable/disable control per provider | EXISTS (`AiProviders:*:Enabled`) → expose on Integrations | P1 | Spec | Existing AiProviders:*:Enabled switch on Configuration → AI Providers (unchanged) | IMPLEMENTED BUT NOT FULLY VERIFIED |
| PK-4.3.2 | Secure credential configuration; never shown to tenants or logged | EXISTS (masked secrets) → reuse | P1 | Test: key never in responses/logs | Existing masked secret settings (unchanged); no insight DTO has a key property (reflection test); key never in log/audit (tests pass) | COMPLETE AND VERIFIED |
| PK-4.3.3 | Model configuration | EXISTS (settings) → expose | P1 | Test | Existing model setting on Configuration → AI Providers (unchanged) | IMPLEMENTED BUT NOT FULLY VERIFIED |
| PK-4.3.4 | Verify Connection action | EXISTS (`IAiProviderVerifier`) → surface + persist result | P1 | Test (mocked HTTP); **live check: owner** | Existing Verify button on Configuration → AI Providers (check unchanged); its result is now recorded. **Live: owner** | IMPLEMENTED BUT NOT FULLY VERIFIED |
| PK-4.3.5 | Connection status and last verification timestamp | NEW | P1 | Test | Status + "Last verified" time on each provider card; "Verified" only for the key+model fingerprint actually checked (test: changing key/model resets it) | COMPLETE AND VERIFIED |
| PK-4.3.6 | Useful error messages | EXISTS → extend | P1 | Test | Normalised codes (UNAUTHORIZED, RATE_LIMITED, TIMEOUT, PROVIDER_ERROR, MALFORMED_RESPONSE…) + scrubbed provider text; tests pass | COMPLETE AND VERIFIED |
| PK-4.3.7 | Supported-capability information | NEW | P1 | Test | Capabilities cover every AI use of the application (18: customer chat, embeddings, keyword suggestions, description rewrite, lead discovery agent, 12 product tasks), grouped by area, declared per provider (Claude: no embeddings; lead discovery: Claude only), verified only by a real successful call; existing features now record their calls (approved wrapper). Tests pass | COMPLETE AND VERIFIED |
| PK-4.3.8 | Configuration change auditing | NEW (settings updates are not audited today) | P1 | Test: audit entry per change | Audit entries: SettingsUpdated (AiProviders / Integrations saves - key names only, never values) / AiProviderVerified / AiPolicyUpdated / AiBenchmarkRun; tests pass | COMPLETE AND VERIFIED |
| PK-4.3.9 | No hardcoded keys/models | EXISTS | P1 | Review | Keys/models only in settings; reviewed | COMPLETE AND VERIFIED |
| PK-4.4.1 | Vendor-independent provider abstraction, dedicated adapters | MODIFY (`IAiTextGenerator`/clients exist; no usage/error detail) | P1 | Tests | IAiCompletionClient (new, additive) with OpenAI/Anthropic/Gemini adapters incl. image input; existing IAiTextGenerator untouched | IMPLEMENTED BUT NOT FULLY VERIFIED |
| PK-4.4.2 | Normalised outputs and errors, provider diagnostics kept | NEW | P1 | Tests | Normalised result: text, model, tokens, duration, code, message; tests per provider shape pass | COMPLETE AND VERIFIED |
| PK-4.5 | Capability list: document analysis, extraction, consolidation, Q&A, custom Q&A, questionnaire generation, benefits analysis, grounded answers, missing-info, conflicts, suggested answers, draft knowledge | NEW (task kinds + capability matrix) | P1 declare · P3 implement | Tests; capability "verified" only after a real call | 12 task kinds in 6 groups, each with its own Off / Simulator / ChatGPT / Claude / Gemini switch on Integrations; the tasks themselves are built in P3 | PARTIALLY IMPLEMENTED |
| PK-4.6.1 | Simulator selectable centrally; results labelled | MODIFY | P1 | Test | Simulator selectable (Product knowledge → Simulator) and every result carries Mode=Simulator + "[SIMULATED]" marker; tests pass | COMPLETE AND VERIFIED |
| PK-4.6.2 | Deterministic scenarios: success, failure, missing evidence, conflict, malformed | NEW | P1 | Tests | Success / MissingEvidence / Conflict / Malformed / ProviderError; tests pass | COMPLETE AND VERIFIED |
| PK-4.6.3 | Simulator never claims live contact/retrieval; never publishes as verified | NEW | P1 · P5 | Tests | Simulator replies carry no evidence and say no source was read; the "never publish" rule is enforced in P5 | PARTIALLY IMPLEMENTED |
| PK-4.7 | Every AI task resolves provider through central config (task → resolver → validate → log) | NEW | P1 | Tests | IAiTaskRunner is the single resolver for product tasks, each following its group's switch. Existing features keep their own paths (not migrated, per P6) but their calls are now recorded in the AI call log by thin wrappers (owner approved 2026-10-19) | PARTIALLY IMPLEMENTED |
| PK-4.8.1 | Explicit, configurable fallback order | NEW | P1 | Tests | Configurable order on the page; tests pass | COMPLETE AND VERIFIED |
| PK-4.8.2 | Fallback respects availability, capability, cost, tenant permission, rate limits | NEW | P1 | Tests | Availability, capability, cost cap, tenant-allowed providers, rate-limit retry; tests pass | COMPLETE AND VERIFIED |
| PK-4.8.3 | Every fallback recorded | NEW | P1 | Test | Every attempt is a row with FallbackFromProvider and a shared correlation id; tests pass | COMPLETE AND VERIFIED |
| PK-4.8.4 | Never silently fall back to Simulator and report live success | NEW | P1 | Test | Test: all providers fail → Live failure, no simulator row; simulator not allowed in the order (validation test) | COMPLETE AND VERIFIED |
| PK-4.8.5 | No unsafe retry of non-idempotent operations | NEW | P1 | Test | Non-idempotent requests: no retry, no fallback; test passes | COMPLETE AND VERIFIED |
| PK-4.X.1 | Accuracy and cost per provider shown (measured benchmark + editable price table) | NEW (owner request) | P1 | Tests; **real numbers come from the owner's keys** | Price per provider = AiProviders:*:InputPer1MUsd/OutputPer1MUsd settings on its card; "Run accuracy test" (6 questions: honesty, real quotes, JSON) + comparison table on Configuration → AI Providers; tests pass. **Real numbers appear once the owner runs it with real keys** | IMPLEMENTED BUT NOT FULLY VERIFIED |

## §5–§7 Extraction, benefits, tenant questions

| ID | Requirement | Baseline | Phase | Validation | Result | Status |
|---|---|---|---|---|---|---|
| PK-5.1 | Structured knowledge model with the listed fields; unresolved stays unresolved | NEW | P3 | Tests | — | NOT IMPLEMENTED |
| PK-5.2 | Distinguish extracted / AI interpretation / suggested language / tenant-provided / tenant-approved | NEW (origin enum exists for facts) | P3 | Test | — | NOT IMPLEMENTED |
| PK-5.3 | Dedupe without losing material distinctions | NEW | P3 | Test | — | NOT IMPLEMENTED |
| PK-6.1 | The 12 standard benefit/value questions | NEW | P3 | Test: all 12 present | — | NOT IMPLEMENTED |
| PK-6.2 | Per question: search → evidence → draft → assess → show → verify → ask only unresolved | NEW | P3–P4 | Tests | — | NOT IMPLEMENTED |
| PK-6.3 | Feature-to-benefit mapping | NEW | P3 | Test | — | NOT IMPLEMENTED |
| PK-6.4 | No invented quantitative outcomes | NEW | P3 | Test | — | NOT IMPLEMENTED |
| PK-7.1 | Tenant-created questions answered from the tenant's sources with citations and confidence | NEW | P3–P4 | Tests | — | NOT IMPLEMENTED |
| PK-7.2 | Approve / edit / reject / unknown, audit saved | NEW | P4 | Tests | — | NOT IMPLEMENTED |
| PK-7.3 | Insufficient evidence → explain + clarify, never invent | NEW | P3 | Test | — | NOT IMPLEMENTED |
| PK-7.4 | Custom questions isolated by tenant | NEW | P3 | Cross-tenant test | — | NOT IMPLEMENTED |

## §8 Presentation and verification UX

| ID | Requirement | Baseline | Phase | Validation | Result | Status |
|---|---|---|---|---|---|---|
| PK-8.1 | Answer card: question, answer, source, page/section, evidence, confidence, status, actions | NEW | P4 | Spec | — | NOT IMPLEMENTED |
| PK-8.1.a | Actions: confirm, edit, reject, another suggestion, unknown, not applicable, add info | NEW | P4 | Spec | — | NOT IMPLEMENTED |
| PK-8.2 | Statuses (Pending, Verified and Approved, Correction Required, Rejected, Information Not Available); separate from confidence | NEW | P4 | Test | — | NOT IMPLEMENTED |
| PK-8.3 | Long answers: summary, detail, evidence, limits, expand/collapse | NEW | P4 | Spec | — | NOT IMPLEMENTED |
| PK-8.4 | Save/resume, review unresolved, filter by status, review evidence, correct without restart | NEW | P4 | Spec | — | NOT IMPLEMENTED |

## §9 Confidence, traceability, conflicts

| ID | Requirement | Baseline | Phase | Validation | Result | Status |
|---|---|---|---|---|---|---|
| PK-9.1 | Traceability fields stored per answer (tenant, KB, source, type, name/URL, page, excerpt, hash, timestamps, provider/model, confidence, status, approver, KB version) | NEW | P3–P5 | Test | — | NOT IMPLEMENTED |
| PK-9.1.a | Source relationship survives into files and other AI services | NEW | P5–P8 | Test | — | NOT IMPLEMENTED |
| PK-9.1.b | Citations are real; never fabricated | NEW | P3 | Quote-verification tests | — | NOT IMPLEMENTED |
| PK-9.2 | Four confidence categories from evidence quality, not fluency | NEW | P3 | Classification tests | — | NOT IMPLEMENTED |
| PK-9.3 | Evidence-grounded; inferences flagged; unsupported claims flagged | PARTIAL (reply validator flags ungrounded numbers) | P3 · P7 | Tests | — | NOT IMPLEMENTED |
| PK-9.4 | Conflicting sources shown, tenant resolves, history kept, date does not auto-decide | NEW | P3–P4 | Tests | — | NOT IMPLEMENTED |
| PK-9.5 | Confidence enforced identically for every provider; provider self-report not relied on | NEW | P3 | Test with each simulator scenario | — | NOT IMPLEMENTED |
| PK-9.6 | Only approved info as tenant fact in customer-facing output; material claims need explicit approval; unsupported → clarify or human | PARTIAL (handoff exists) | P7 | Chat tests | — | NOT IMPLEMENTED |

## §10–§13 Approval, output file, versioning, logging

| ID | Requirement | Baseline | Phase | Validation | Result | Status |
|---|---|---|---|---|---|---|
| PK-10.1 | State tracking: extracted / pending / confirmed / corrected / rejected / unresolved | NEW | P4 | Test | — | NOT IMPLEMENTED |
| PK-10.2 | Audit trail for ingestion, facts, answers, confidence, edits, approvals, clarifications, conflicts, publication | PARTIAL (fact revisions exist) | P3–P5 | Tests | — | NOT IMPLEMENTED |
| PK-10.3 | Approver and timestamp; approvals never silently overwritten | NEW | P4 | Test | — | NOT IMPLEMENTED |
| PK-11.1 | **Draft knowledge file (plain text)** with overview, features, benefits, problems/use cases, answers, custom Q&A, sources, confidence, status, conflicts, missing, unresolved; labelled draft | NEW (amended: text, not PDF) | P6 | Test | — | NOT IMPLEMENTED |
| PK-11.2 | **Final approved knowledge file (plain text)**: approved content only, with references | NEW (amended) | P6 | Test: unresolved never appears as fact | — | NOT IMPLEMENTED |
| PK-11.3 | Approved knowledge stored in the structured database and retrieval index, not only the file | NEW | P5 | Test | — | NOT IMPLEMENTED |
| PK-11.4 | Knowledge reaches AI chat, campaigns, follow-ups, video scripts | NEW | P7–P8 | Tests | — | NOT IMPLEMENTED |
| PK-12.1 | Versioned knowledge; revalidation on new/replaced source, site change, edit, conflict resolution, approve/reject | NEW | P5 | Tests | — | NOT IMPLEMENTED |
| PK-12.2 | Affected answers identified and flagged; history never erased | NEW | P5 | Tests | — | NOT IMPLEMENTED |
| PK-13.1 | AI execution record (provider, model, task, tenant/correlation, live/simulator, times, success, tokens/cost, retries/fallbacks, error codes) | NEW | P1 | Test | AiExecutions table (migration AddAiExecutions) with provider, model, task, tenant, correlation, mode, timing, tokens, cost, attempt, fallback, error; tests pass | COMPLETE AND VERIFIED |
| PK-13.2 | Never log keys/tokens; avoid sensitive document content | NEW | P1 | Test | Test: no prompt, document text or key is stored; key-shaped text scrubbed from errors | COMPLETE AND VERIFIED |

## §14–§17 Security, architecture, data, tests

| ID | Requirement | Baseline | Phase | Validation | Result | Status |
|---|---|---|---|---|---|---|
| PK-14.1 | Tenant isolation for documents, knowledge, retrieval, questions, answers, files, references | EXISTS (global tenant filter) → new tables | P2–P7 | Cross-tenant tests per endpoint | — | NOT IMPLEMENTED |
| PK-14.2 | Upload validation and safe processing | MODIFY | P2 | Tests | — | NOT IMPLEMENTED |
| PK-14.3 | Credentials protected; integration management Platform-Admin only; backend authorisation (not UI-only) | EXISTS pattern | P1 | Role-denial tests | Provider endpoints PlatformSuperAdmin-only (attribute test); credentials write-only | COMPLETE AND VERIFIED |
| PK-14.4 | Logs/files do not expose sensitive info; unauthorised operations fail safely | NEW | P1–P8 | Tests | — | NOT IMPLEMENTED |
| PK-15 | Logical responsibilities mapped onto existing architecture, no duplicated services | — | all | Review at P9 | — | NOT IMPLEMENTED |
| PK-16 | DB/API/UI changes identified; migrations and indexes; reuse existing tables | — | all | Per phase | — | NOT IMPLEMENTED |
| PK-17.1 | Source-processing tests | NEW | P2 | Run | — | NOT IMPLEMENTED |
| PK-17.2 | Q&A tests | NEW | P3 | Run | — | NOT IMPLEMENTED |
| PK-17.3 | Confidence/verification tests | NEW | P3–P5 | Run | — | NOT IMPLEMENTED |
| PK-17.4 | Integration tests — mocked tests clearly separated from live; live verification by owner | NEW | P1 | Run | Mocked integration tests pass and are labelled as mocked; live provider tests are the owner's (keys not available to me) | IMPLEMENTED BUT NOT FULLY VERIFIED |
| PK-17.5 | Security tests | NEW | P2 · P8 | Run | — | NOT IMPLEMENTED |
| PK-17.6 | Knowledge-file and publication tests | NEW | P5–P6 | Run | — | NOT IMPLEMENTED |

## §18–§22 Process and acceptance

| ID | Requirement | Phase | Status |
|---|---|---|---|
| PK-18 | This matrix kept current; full audit at the end | all · P9 | PARTIALLY IMPLEMENTED |
| PK-19 | Phases followed in order, none skipped silently | all | PARTIALLY IMPLEMENTED |
| PK-20.1–20.20 | The 20 acceptance criteria (§20) | P9 | NOT IMPLEMENTED |
| PK-21 | Final deliverables 1–14 | P9 | NOT IMPLEMENTED |
| PK-22 | Final audit against every requirement | P9 | NOT IMPLEMENTED |

---

## Phase log

### Phase 0 — 2026-10-19
Proposal approved; matrix created. No code changed.

### Phase 1 — integration foundation (2026-10-19)
**Built.** API: `AiExecution` entity + migration `AddAiExecutions`; `IAiTaskRunner` (single resolver with capability, on/off, key, tenant-permission and cost checks, retries for transient errors, configurable fallback, JSON validation, execution log); `IAiCompletionClient` (ChatGPT/Claude/Gemini adapters returning tokens, model, timing, normalised errors, image input); simulator scenarios; `PlatformAiProvidersService` + `PlatformAiProvidersController` (`api/v1/platform/ai-providers`: overview, update, verify, benchmark, policy, executions); "Product knowledge" engine choice added to the existing feature routing; 16 new settings (policy, prices, product-knowledge choice). Angular: "AI providers" section on Platform → Integrations (cards, compare table, policy, call log) and the Product knowledge engine choice.
**Tests run.** API full suite 1,692 passed, 0 failed (69 new). Angular: new and changed specs pass (see final run in the PR).
**Not verified.** No live provider call was made by me (no keys) — the owner verifies each provider with Verify connection and the accuracy test. The page was not checked in a running app (the running API must be rebuilt with this branch first).
**Existing logic touched (approved P5/P6, additive).** `AiFeatures` gained `ProductKnowledge`; `PlatformAiFeatureSettingsDto`/request gained a field; `AiFeatureOptions` gained Policy/Pricing/ProductKnowledge; settings catalog gained keys. Nothing was removed or changed in behaviour for existing features.
**Correction - no duplicate provider screen (owner feedback, 2026-10-19).** The first cut put provider cards (key, model, On/Off, Verify) on Integrations, repeating Configuration → AI Providers. Now: provider settings live only on Configuration → AI Providers, which also shows the last Verify, status, the accuracy test, capabilities and a comparison table; prices moved into each provider's settings (`AiProviders:{P}:InputPer1MUsd/OutputPer1MUsd`, the `Integrations:Ai:Pricing:*` keys are gone). Integrations keeps the Product knowledge engine choice, the AI policy card and the AI call log (`platform-ai-policy`). The duplicate endpoints (PUT provider, POST verify) were removed; the existing `POST settings/ai-providers/verify` now records its result, and saves of the AiProviders and Integrations settings are audited (key names only). Tests: API 1,688 passed; Angular 1,029 passed; build OK.
**Owner feedback - app-wide capabilities and per-task switches (2026-10-19).** (1) The capability list on each provider card now covers every place the application uses AI, not only product knowledge: customer chat replies, knowledge base embeddings, domain keyword suggestions, the business description rewrite, search keyword suggestions, the lead discovery agent, and the 12 product tasks - grouped by area, with what each provider's code cannot run marked "not supported". Each card also says what currently runs on it. To make "verified" real for the existing features, their calls are recorded in the AI call log by recording wrappers (owner approved): the features' own code is unchanged apart from naming the use around a one-shot text call; nothing is recorded for simulated calls; no prompt, reply or key is stored; embeddings are throttled (one success per provider per 10 minutes, one failure a minute); a recording failure never fails the feature. (2) Product knowledge has six switches on Integrations instead of one - Reading documents and PDFs; Reading scanned pages and images (default Off); Suggested answers; Questionnaire and benefits; Gaps and conflicts check; Draft knowledge file - each Off, Simulator, or ChatGPT / Claude / Gemini. The policy's separate "scanned documents via AI" switch is gone: it is that group's Off. Tests: API 1,717 passed; Angular 1,032 passed; build OK. **Not verified live** (needs the running API rebuilt from this branch and real keys).
