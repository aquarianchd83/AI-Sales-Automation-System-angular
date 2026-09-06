# WhatsApp Sales Automation — Customer Demo Script

Two versions in this doc: a **~75–90 second teaser** (right below) for a first-touch send —
LinkedIn, an email intro, a Slack drop — and the **full ~14–16 minute walkthrough** (further
down) for an actual customer meeting. Record both in one sitting using the same setup; the
teaser is largely a re-cut of the full recording's best moments, not a separate take.

**Recording tools:** OBS Studio (free), Loom, or Windows' built-in Xbox Game Bar (`Win+G`).
Record at 1080p, browser window maximized, zoom to ~110% in the browser so text reads clearly
on a shared screen.

---

## Teaser cut (~75–90 seconds)

Same setup checklist as the full version applies (below) — this just uses a slice of it.
Leads with the live AI-reply moment because it's the single most convincing thing this
product does; everything else is a fast flash to prove there's real depth behind it.

**Structure — 4 beats, cut tight, no dead air:**

| Time | Screen | Say / show |
|---|---|---|
| 0:00–0:08 | Inbox, nothing clicked | *"Watch this — a customer messages in, and the AI handles it. No agent involved."* |
| 0:08–0:40 | Run the trigger script (see Section 5b below) → cut to the conversation | Show the inbound message, the AI's reply appearing directly under it, and the confidence/intent row. *"That's a real signed WhatsApp webhook hitting the API right now — the AI detecting intent, generating a grounded reply, and sending it back. Live."* |
| 0:40–1:10 | 3 quick cuts, ~7–8s each: Campaign detail (steps + status), Leads pipeline (score column), Handoffs queue | One continuous line over all three: *"Every campaign runs itself on schedule, every lead gets scored automatically as the AI talks to them, and anything the AI isn't sure about lands in a queue for a human."* |
| 1:10–1:30 | Back to Dashboard, or a title card if you have one | *"One platform, from outbound campaign to AI-qualified lead. Let's talk about what this looks like for you."* |

**Editing tip:** cut Beat 3 down to 2 clips (Campaigns + Leads, drop Handoffs) if you need to
land under 60 seconds flat — Handoffs is the least essential of the three for a cold-open
teaser since Section 5b already implies escalation exists.

---

## Full walkthrough (~14–16 minutes)

Cut Section 8 (Knowledge Base/Admin) for a shorter cut if needed — everything else is core
product story.

---

## Before you hit record — a 5-minute setup checklist

Do this *before* recording so nothing stalls mid-take:

1. **Both servers running**: API at `https://localhost:59205`, Angular dev server at
   `http://localhost:4200` (`npm start`).
2. **Log in** as a SuperAdmin so every menu item is visible (Users & Roles is
   SuperAdmin/Admin-only — log in as one of those, or you'll need to switch accounts for
   Section 8).
3. **Seed a few things in advance** so screens aren't empty on camera:
   - At least one **Message Template** already Approved.
   - At least one **Campaign** with steps attached and, ideally, one that's actually
     `Running` or `Stopped` (not just `Draft`) — a lifecycle with history reads better
     than an empty new campaign.
   - At least one **Knowledge Base article**, Published.
   - A test **Customer** with a real, distinctive name (not "Test Test") — you'll message
     "as them" in Section 5.
4. **Have the AI-demo script ready** (see the box at the end of Section 5) in a terminal
   tab, pre-filled, so triggering the "customer messages in → AI replies live" moment is
   one keypress, not a typing delay on camera.
5. Close any unrelated browser tabs/notifications. Silence Slack/Teams.

---

## Cold open (0:00–0:30)

**Screen:** Campaign list or Dashboard, nothing clicked yet.

**Say:**
> "This is a WhatsApp sales automation platform — it runs your outbound campaigns, lets an
> AI qualify and respond to inbound replies automatically, and hands off to a human agent
> the moment a conversation needs one. I'm going to walk through it end to end, including
> watching the AI actually respond to a live message."

---

## Section 1 — Orientation (0:30–1:30)

**Screen:** Dashboard, then hover down the left nav without clicking everything.

**Show:** The sidebar — Dashboard, Customers, Inbox, Handoffs, Leads, Knowledge Base, Tags,
Campaigns, Media Library, Message Templates, Users & Roles.

**Say:**
> "Everything's organized around the customer lifecycle: you manage your contacts and
> tags, run outbound Campaigns, and everything that comes back in — replies, escalations,
> qualified leads — flows through Inbox, Handoffs, and Leads. The AI's knowledge comes
> from the Knowledge Base."

---

## Section 2 — Customers & Tags (1:30–3:00)

**Screen:** Customers list.

**Show:**
- The customer table — phone, opt-in status, tags.
- Open one customer to show their detail (tags, opt-in history).
- Tags page — a couple of tags, and mention bulk-tagging from the customer list.

**Say:**
> "Every contact has an opt-in status — WhatsApp requires explicit consent before you can
> message someone commercially, and the platform enforces that at send time, not just as
> a UI suggestion. Tags are how you segment your audience for campaigns — 'VIP', 'Cold
> Lead', whatever fits your business."

---

## Section 3 — Campaigns, the outbound engine (3:00–7:00)

This is the meatiest section — take your time here.

### 3a. Campaign list

**Screen:** Campaigns list.

**Show:** The status legend (hover a chip or two to show the tooltips), the table columns
— Scheduled start / Start date / End date, all with full date+time.

**Say:**
> "Every campaign moves through a real lifecycle — Draft, Scheduled, Running, Paused,
> Stopped, Completed — and the UI only ever offers actions that are actually valid for
> where a campaign is right now."

### 3b. Create a campaign

**Screen:** Click **New campaign**.

**Show:**
- Name/description.
- The scheduled-start **date + time picker** — pick a date, then set a specific time.

**Say:**
> "You can schedule a campaign for a specific date and time — not just midnight — and it
> promotes itself to Running automatically when that moment arrives."

### 3c. Steps — Initial + unlimited follow-ups

**Screen:** Open a campaign's detail page → Steps section.

**Show:**
- Add the Initial step (pick a template).
- Add a follow-up, showing the delay-days field.
- Mention (don't necessarily add live, for time) that there's **no cap** on the number of
  follow-ups — Initial, FollowUp1, FollowUp2, ...FollowUp*N*, as many as the sequence
  needs.

**Say:**
> "Steps attach in strict order — you can't leave a gap — but there's no limit on how many
> follow-ups a sequence can have. Each one can wait any number of days after the previous
> one actually sent."

### 3d. Audience + End date projection

**Screen:** Attach an audience by tag. Point out the **End date** column/field.

**Say:**
> "Once a campaign has a start date and at least one active step, the platform projects a
> finish date automatically — start plus the total delay across the sequence. If the
> campaign gets Stopped, that becomes the exact stop time instead of an estimate."

### 3e. Lifecycle — Start / Pause / Resume / Stop / Run job now

**Screen:** Start the campaign (or use one already Running).

**Show:**
- Pause → Resume.
- **Stop**, then show it can still be **Resumed** afterward (call this out — it's not a
  dead end).
- The **⚡ Run job now** icon, per-campaign — click it, show the result dialog (sends
  counted, considered, skipped).
- If the campaign is Stopped, show it can also be **Deleted** now (not just Draft
  campaigns) — and the confirm dialog warning that deleting a Stopped campaign also
  erases its message history.

**Say:**
> "Normally the send pipeline runs on its own schedule, but you can force it to run right
> now for one campaign — useful for demos like this one, or nudging a backlog. And
> stopping a campaign isn't permanent — you can resume it later, or delete it entirely if
> you're done with it, which also cleans up its message history."

---

## Section 4 — Message Templates & Media (7:00–8:00)

**Screen:** Message Templates list, then Media Library.

**Show:** A template's Approve/Reject review action. The media library grid.

**Say:**
> "Templates go through an approval step before a campaign can use them — mirroring
> WhatsApp's own template approval process. Media assets attach to a step and get sent
> alongside the message."

---

## Section 5 — Inbox: where the AI lives (8:00–12:00)

This is the highlight of the demo. Slow down here.

### 5a. Inbox list

**Screen:** Inbox.

**Show:** The status filter toggles (Open/Escalated/Closed/All), the Lead-score column.

**Say:**
> "Every reply — whether it came from a campaign follow-up or a customer messaging in out
> of the blue — lands here as a conversation."

### 5b. Trigger a live AI reply, on camera

This is the moment that sells the product. Have the terminal ready.

**Say, before running it:**
> "Let me simulate a real customer message coming in right now, the same way WhatsApp
> would deliver it — signed webhook and all — so you can watch the AI respond live."

**Run** the prepared script (see box below), then **immediately switch to the Inbox** and
refresh — the new conversation should appear within a couple of seconds.

**Open the conversation. Show, in order:**
1. The inbound message you just "sent."
2. The AI's reply directly underneath it — sent automatically, no agent involved.
3. The **AI row**: confidence percentage, detected intent, and (if a Lead exists yet) the
   lead-score chip.
4. The AI-maintained **summary** line.

**Say:**
> "That whole loop — inbound message, intent detection, a grounded reply, sent back over
> WhatsApp — happened with no human in it. The confidence score and detected intent are
> right there, so an agent glancing at the inbox knows at a glance how sure the AI was."

> **Reusable trigger script** — adapt the phone number and message text, save as
> `simulate-inbound.ps1`, run from a PowerShell prompt with the API running:
> ```powershell
> [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
> [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
>
> $phone = "919815733426"          # E.164 digits, no '+', no country-code prefix issues
> $messageText = "Hi, what's the price?"   # try "I want a refund, this is terrible" for the escalation path instead
>
> $msgId = "wamid.DEMO_" + [guid]::NewGuid().ToString("N")
> $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
> $payloadObj = @{ entry = @(@{ changes = @(@{ value = @{
>     contacts = @(@{ wa_id = $phone; profile = @{ name = "Demo Customer" } })
>     messages = @(@{ id = $msgId; from = $phone; timestamp = $timestamp; type = "text"; text = @{ body = $messageText } })
> } }) }) }
> $body = $payloadObj | ConvertTo-Json -Depth 10 -Compress
>
> $secret = "dev-app-secret-not-for-production"   # matches appsettings.Development.json — dev only
> $hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($secret))
> $hex = -join ($hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($body)) | ForEach-Object { $_.ToString("x2") })
>
> Invoke-WebRequest -Uri "https://localhost:59205/api/v1/webhooks/whatsapp" -Method POST `
>   -Body $body -ContentType "application/json" `
>   -Headers @{ "X-Hub-Signature-256" = "sha256=$hex" } -UseBasicParsing
> ```
> Swap `$messageText` to something like *"I want a refund, this is terrible"* to demo the
> **escalation** path instead (Section 6) — that one raises a Handoff instead of
> auto-replying.

### 5c. Manual agent reply — text vs. template

**Screen:** Same conversation, scroll to the composer.

**Show:**
- The Text/Template toggle.
- Type a free-text reply and send it (only works within the 24h customer-service window —
  mention this).
- Switch to Template mode, pick one, send it (works anytime).

**Say:**
> "An agent can jump in and reply manually at any point — free text if the customer
> messaged recently enough for WhatsApp's service window to still be open, or an approved
> template otherwise, which works regardless of timing."

### 5d. Mode switch + assign + close

**Show:** Switch Mode to Human (AI stops replying to this thread), assign to an agent,
Close the conversation.

**Say:**
> "You can take a conversation fully off autopilot, hand it to a specific agent, or close
> it out once it's resolved."

---

## Section 6 — Handoffs: human escalation (12:00–13:30)

**Screen:** Handoffs queue.

**Show:**
- If you ran the "refund/terrible" message from the script above, the new Pending handoff
  should be sitting here — open it.
- **Claim** it.
- **Resolve** it, with a note.

**Say:**
> "Whenever the AI isn't confident enough, or the customer's message signals a complaint,
> a negotiation, or an explicit request for a human, it escalates here instead of guessing.
> An agent claims it, works it, and resolves it with a note for the record."

---

## Section 7 — Leads: AI-driven qualification (13:30–15:00)

**Screen:** Leads pipeline.

**Show:**
- The stage/score columns, filter by stage or score.
- Open the lead created by your demo conversation (if it extracted budget/interest/
  timeline from the message).
- The **activity timeline** — point out entries with no agent name (AI-driven) versus ones
  with an agent's name (manual corrections).

**Say:**
> "As the AI talks to a customer, it's also extracting budget, interest, and timeline
> signals in the background, and scoring the lead Hot/Warm/Cold automatically. An agent
> can always correct the stage or the extracted details by hand — every change, automatic
> or manual, is on the record here."

---

## Section 8 — Knowledge Base: what grounds the AI (15:00–16:00, optional)

**Screen:** Knowledge Base.

**Show:**
- An existing Published article.
- Create a new one, show the Publish action (chunk + embed).
- Mention Reindex for bulk re-embedding after edits.

**Say:**
> "This is what the AI actually cites when it answers a factual question — only Published
> articles are used, so you control exactly what the AI is allowed to say by what you
> publish here."

---

## Closing (last 30 seconds)

**Screen:** Back to Dashboard or Inbox.

**Say:**
> "So end to end: you build a campaign, it reaches out on schedule, replies come back into
> one inbox, the AI handles what it's confident about and hands off the rest to a human,
> and every lead gets scored and tracked automatically along the way. Happy to go deeper
> on any piece of this."

---

## Notes for whoever edits this down

- The single strongest clip for a trailer/teaser cut is **Section 5b** (live AI reply) —
  lead with that if you're cutting a 60-second version instead of the full walkthrough.
- If something errors on camera (a stale customer-service-window message, a validation
  message), that's fine to leave in for authenticity, or cut and re-take just that beat —
  no need to re-record the whole section.
