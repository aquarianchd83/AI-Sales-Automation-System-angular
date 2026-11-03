# AI Content Studio (Cinematic) — Analysis, Feasibility and Phased Plan

Status: **DRAFT FOR APPROVAL. No product code has been written.**
Branches: `feature/ai-content-studio-cinematic`, cut from `origin/main` (Angular) and `origin/master` (API).

Labels used below: **[V]** verified from a source (listed at the end, re-check before budgeting), **[A]** assumption, **[R]** recommendation, **[Q]** open question.

---

## 1. Executive summary and scope

A user enters a topic ("Guru Ji resolves a couple's argument"). The system produces a ~30 s, 9:16 MP4: story and script, reusable characters, three ~10 s scenes, per-character dialogue (Hindi / English / Hinglish), lip-synced clips, mixed audio, subtitles. Publishing to YouTube Shorts, Facebook Reels and Instagram Reels is a separate, explicit step.

**This is a second product inside the existing "Content Studio".** The existing module (phases 1-8 of the earlier blueprint) makes *marketing videos from verified business facts* (Shotstack slideshow-style renders, Google TTS, Pexels stock). This one makes *character-driven cinematic storytelling*. They share infrastructure but not workflow. [R] Build it as a separate bounded module (`Cinematic*` / route `/content-studio/stories`), reusing: tenancy, `IAiTaskRunner`, `IStudioMeteringService` (charge-before-work, refund-on-failure), `ISecretProtector`, Hangfire, S3 store, and the YouTube client.

### Important repo finding
`feature/content-studio-planner` (old phases 3-8: render jobs, Hangfire render processor, `ITenantFileLinks` signed links, YouTube publishing, `SocialConnection`) is **not merged** to `main`/`master`. Branching from the default branch means this work does **not** yet have those pieces. Default branch has: Hangfire, AWSSDK.S3 (`S3TenantDocumentStore`), `IAiTaskRunner`, `IStudioMeteringService`, `ISecretProtector`.
**[Q1]** Merge the planner branch first (recommended; the YouTube publishing and signed-link pieces are directly reusable), or build independently from default?

## 2. Provider capability findings (the feasibility core)

| Capability | Finding | Impact |
|---|---|---|
| **Google Flow API** | **[V] No official Flow API.** Flow is a subscription app. Programmatic Veo access is via the **Gemini API** or **Vertex AI**. Third-party Flow wrappers automate a consumer account (browser automation / private endpoints) and risk account bans and ToS violations. | The prompt's mandatory "Google Flow" cannot be automated legitimately. **[R]** Replace with **Veo 3.1 via the Gemini API** behind `ISceneVideoProvider`. Flow remains a manual/assisted import path (user generates in Flow, uploads the clip). Needs your approval (D1). |
| **Veo 3.1 (Gemini API)** | **[V]** 8 s clips, 720p/1080p/4K, native audio. Per-second pricing, audio included: Standard ~$0.40/s (720p/1080p), Fast ~$0.10-0.12/s, Lite ~$0.05-0.08/s. Third-party sites conflict on numbers; Google's page is authoritative. | 8 s clips, not 10 s. Plan for **4 x 8 s or 3 x 8 s + trim/extend**, not 3 x 10 s. A 30 s story = about 24-32 s of generated footage. |
| **Lip-sync from prompt alone** | **[A]** Veo native audio generates speech, but voice identity consistency across clips, Hindi quality and exact scripted words are **unverified**. Prompt engineering cannot guarantee them. | Must be proven in the Phase 1 proof of concept. |
| **Dedicated lip-sync (Sync Labs / sync.so)** | **[V]** Billed per output second: lipsync-2 ~$0.04-0.05/s, lipsync-2-pro ~$0.067-0.083/s, sync-3 ~$0.107-0.133/s. Free tier capped at 20 s. **[Q]** Supported languages and commercial terms not found; must read their ToS/docs. | Fallback path: Veo silent/any-audio clip + our TTS audio -> lip-sync provider. Cost +~$1.5-4 per 30 s. |
| **TTS** | OpenAI speech and Google Cloud TTS (already integrated for the old module). Hindi/Hinglish quality **unverified**. | Test both in the PoC with the same Hindi script. |
| **YouTube upload** | **[V]** Default quota 10,000 units/day. `videos.insert` cost reported as 1,600 (older docs) vs ~100 (a third-party claim of a Dec 2025 change, **unconfirmed**). Unverified Google projects upload privately; a compliance audit is needed for public uploads (already noted in the old blueprint). | Reuse existing YouTube client. Lead time is weeks. |
| **Instagram / Facebook Reels** | Search returned nothing usable. **[A]** Meta Graph API supports Reels publishing for professional IG accounts / Pages, needs `instagram_content_publish` / `pages_manage_posts` with App Review, and the video must be at a public URL at publish time. **Unverified; must be checked on developers.facebook.com.** | Phase 5 only. Manual download works from day one. |
| **Character image generation** | OpenAI image API is already in use; character consistency across scenes is only as good as the video model's reference-image support. Veo 3.1 reference-image support **unverified**. | PoC item. |
| **FFmpeg** | Not installed on this dev machine. Needs a worker image or VM with FFmpeg. | **[Q3]** Where do renders run (API host, separate worker, container)? |

### Cost model for one 30 s video (**illustrative, [A]; replace with PoC actuals**)
Using verified per-second rates above, 4 x 8 s = 32 s generated:
- Veo Fast 1080p: 32 x $0.12 = **~$3.84**; Veo Standard: 32 x $0.40 = **~$12.80**.
- Optional lip-sync pass (lipsync-2, 30 s x $0.05): **~$1.50**.
- TTS, script (LLM), storage: cents.
- Failed attempts: if 1 in 3 clips needs one regeneration, add ~33% to the video line; scene-level regeneration keeps this bounded (a bad clip costs 1 clip, not 4).
- Character images: one-time per character, then free on reuse.
Per-tenant budget caps and pre-confirmation of regeneration are required (section 7).

## 3. Decisions needing your approval

- **D1** Replace "Google Flow" with **Veo via Gemini API** (Flow as manual import only). *Recommended.*
- **D2** Treat Veo's 8 s limit as the clip unit (3-4 clips, final trim to ~30 s).
- **D3** Lip-sync strategy decided by PoC result: Veo native audio first; Sync Labs fallback only if the PoC fails the thresholds in section 5.
- **D4** Merge planner branch first (Q1) or not.
- **D5** FFmpeg runtime location (Q3).
- **D6** Quota ledger: new types `CinematicScriptGenerations`, `CinematicVideoSeconds`, `CharacterImages`, `LipSyncSeconds` on the existing ledger (matches earlier decision to extend the ledger).
- **D7** Who pays provider costs: platform keys with tenant quota (as now), or tenant-supplied keys. *Assumed: platform keys + metering.*

## 4. Architecture (reuse-first)

- **Angular**: new area `/content-studio/stories` (project list, script editor, character picker with the three options, scene board with clip status/replace/flag, subtitle editor, final review, publish).
- **API**: new controllers under `api/v1/content-studio/stories`; services: `IStoryScriptService` (OpenAI structured output through `IAiTaskRunner`, JSON-schema validated before save), `ICharacterLibraryService`, `ISceneVideoProvider` (Veo adapter, Flow-import adapter, simulator), `ISpeechProvider`, `ILipSyncProvider` (optional), `IStoryRenderService` (FFmpeg), `IStoryPublishingService` (reuses YouTube client; Meta later).
- **Jobs**: Hangfire (already present). One job per stage, DB status is the source of truth, idempotency key per paid call, no auto-retry on paid generation beyond a configured cap, resume = re-enqueue failed scene only.
- **Storage**: S3 private objects, keys in SQL, signed URLs, SSE, lifecycle rules. No blobs in SQL.
- **Simulator mode** for every provider so the whole flow is testable at zero cost (existing pattern).

## 5. Lip-sync acceptance criteria (measurable, proposed)

Reviewed on a fixed set of 10 test scripts (4 Hindi, 3 Hinglish, 3 English), by two human reviewers plus an automated check:
1. **Speaker accuracy** 100%: only the assigned character's mouth moves for each line; listeners static.
2. **Timing**: audio-to-mouth offset <= 120 ms on >= 90% of dialogue lines; no visible drift > 200 ms.
3. **Intelligibility**: Hindi/Hinglish words transcribed back by speech-to-text with word error rate <= 15%.
4. **Clip join**: no dialogue cut mid-word at scene boundaries.
5. **Cost**: first-pass acceptance >= 60% of clips; otherwise Sync Labs fallback becomes mandatory.
If thresholds fail on both Veo-native and fallback, the product is reduced to "assisted mode" and the plan is re-scoped before Phase 2.

## 6. Data model (proposed, tenant-owned, all with `TenantId`, `CreatedAt/By`, `UpdatedAt/By`)

`StoryProject` -> `StoryScriptVersion` (JSON, status Draft/Approved, hash) -> `StoryScene` (index, target seconds, prompt, status) -> `DialogueLine` (speaker CharacterId, text, language, start/end ms, `AudioAsset`).
`StoryCharacter` (name, description, personality, voice prefs, visibility Private/Shared, rights-confirmed flag + who/when) -> `CharacterReferenceAsset` (S3 key, status Uploaded/Generated/Approved/Superseded, never overwritten, versioned).
`GenerationJob` (type, status Queued/Processing/Completed/Failed/Cancelled, attempts, provider job id, idempotency key, error, cost) -> `MediaAsset` (kind, S3 key, duration, w/h/fps, checksum, retention) -> `VideoRender` (inputs hash, output asset, validation results).
`UsageLedgerEntry` (category: Script, CharacterImage, Video, Speech, LipSync, Storage; estimated vs actual cost; failed flag), `PublishingDestination`, `PublishingJob` (reuses existing publishing tables if the planner branch is merged).
Retention: intermediates 30 days, originals and approved assets kept while the project exists, finals per tenant policy.

## 7. Cost and budget controls
Pre-paid-operation estimate shown and confirmed; per-project and per-tenant budgets; retry cap (default 1 automatic, none for paid video); explicit confirmation for regenerating a scene; script approval gate before any video spend; character approval before saving; separate ledger categories; failed-generation cost shown where provider billing exposes it.

## 8. Security and tenancy
Tenant filter on every query; private character access checks; clone/share only via explicit action; upload validation (magic-byte type check, size cap, image decode, re-encode to strip metadata/payloads); rights/consent checkbox stored; keys through `ISecretProtector`/platform settings (not appsettings, per your earlier rule); rate limits per tenant; structured logs with job ids.

## 9. Failure and recovery
Provider timeout/rate limit -> backoff, scene stays `Queued`; worker restart -> jobs re-read DB state, provider job id used to resume polling rather than re-submit (prevents double billing); partial failure -> only failed scene regenerates; refund on definitive failure via the metering service; ambiguous submit -> never auto-retry.

## 10. Phased plan (the prompt's phases, with changes)

| Phase | Content | Exit criteria |
|---|---|---|
| **1 PoC** | Console/test harness, one Hindi script, 3 clips via Veo (Gemini API, billed small), TTS comparison, optional sync.so, FFmpeg merge, S3 upload, ffprobe validation. Produces measured cost and lip-sync results. | Section 5 thresholds measured; go/no-go. **Needs your Gemini API key and (optionally) sync.so key; real spend est. ~$10-30.** |
| 2 Core Studio | Entities + migration, script generation/editor, character library with the three options, S3 | Script and character flows work in simulator mode |
| 3 Pipeline | Jobs, Veo adapter, FFmpeg render, subtitles, scene replace | End-to-end video in simulator + one live run |
| 4 Cost/QA | Ledger categories, budgets, lip-sync review UI, final approval | Budget stops spend; review gate enforced |
| 5 Publishing | YouTube (reuse), Reels (after Meta feasibility check) | Manual download always works |
| 6 Hardening | Security review, load test, runbook | Checklist signed |

Phase 1 comes first because Veo's 8 s limit, Hindi lip-sync and consistency are unverified and decide the shape of everything after it.

## 11. Backlog, tests, Definition of Done (summary)
Unit tests per service (schema validation, gating, ledger), integration tests with simulator providers, a golden-file FFmpeg test (duration/dimensions/fps/audio via ffprobe), tenant-isolation tests for every endpoint, and one live smoke test per provider. Each phase is done when it builds, tests pass, migration applies, and a report of changed files, config and unverified items is delivered. Nothing is called "implemented" without verification.

## 12. Sources (re-check before budgeting)
- Veo/Gemini API pricing summaries: https://benchlm.ai/media-pricing/veo, https://the-decoder.com/google-veo-3-adds-1080p-916-video-and-drops-prices-by-half/ (authoritative: Google's Gemini API pricing page)
- Flow has no public API: https://www.wireflow.ai/blog/google-flow-api
- Sync Labs billing: https://sync.so/docs/product/billing
- YouTube quota: https://developers.google.com/youtube/v3/determine_quota_cost
- Not found / unverified: Meta Reels publishing requirements, sync.so language list and commercial terms, Veo reference-image consistency, Hindi TTS quality.

---

## 13. Delivery status (2026-11-03)

Built and tested against simulators and the real ffmpeg: characters (upload / library / generated from the script), script generation and approval, clips from Simulator / Flow import / Veo, final render with subtitles, subtitle corrections, final approval, voice-over (replaces a scene's audio with generated speech), cost by category in the studio ledger, a publish pack and a manual "where I posted it" record, and a setup check (`GET api/v1/content-studio/stories/diagnostics`).

**Decisions made while building**
- Clips keep their own audio by default. A voice-over is optional per scene and replaces it; lines whose speech overruns their slot are reported, never sped up.
- Publishing is manual: the studio prepares titles, descriptions and tags and records the post address. Direct posting needs Google and Meta OAuth apps, app review and account authorisation, which cannot be set up or tested here.
- Lip-sync is not built. A provider such as sync.so takes video and audio by URL, which needs time-limited links to the private S3 objects (the studio's file store has none yet). Decide after a live test of Veo clips in Hindi.

**Needs a person with keys (cannot be verified from here)**
1. Veo: set `ContentStudio:Cinematic:GeminiApiKey` and run one real 8-second clip. Compare the cost with the estimate.
2. Pictures and speech: set the OpenAI key and switch `CharacterImageProvider` / `SpeechProvider` to OpenAI; try one Hindi line.
3. Subtitle font: install Noto Sans Devanagari on the host, set `SubtitleFontsDirectory` and `SubtitleFontName`. The setup check shows when none is found.
4. ffmpeg: install on the host and set `FfmpegPath` / `FfprobePath` if it is not on PATH.
5. Run the Hindi lip-sync acceptance checks in section 5 on real output before deciding on a lip-sync provider.
