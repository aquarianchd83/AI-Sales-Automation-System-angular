# Conversations — flows

What happens between a customer's WhatsApp message arriving and a reply (from the AI or an agent) going
back. All charts are traced from the code. Index of every module's charts:
[docs/MODULE-FLOWS.md](../../../../docs/MODULE-FLOWS.md).

| Where the logic lives | File |
| --- | --- |
| UI rules (window, closed) | [conversation.model.ts](../../core/models/conversation.model.ts) — `canSendFreeText`, `canActOnConversation` |
| HTTP calls | [conversation.service.ts](../../core/services/conversation.service.ts) |
| Webhook entry (API) | `AI-Sales-Automation-System-api/.../Api/Controllers/WebhooksController.cs` |
| Inbound processing (API) | `.../Application/Webhooks/InboundWebhookProcessor.cs`, `.../Infrastructure/BackgroundJobs/InboundWebhookProcessingJob.cs` |
| AI decision (API) | `.../Application/Ai/ConversationOrchestrator.cs` |
| Opt-out detection (API) | `.../Application/Common/OptOutDetector.cs` (layers 1-2), `.../Application/Ai/AiReplyValidator.cs` (layer 3) |
| Agent actions (API) | `.../Application/Conversations/ConversationService.cs` |

---

## 1. Inbound webhook, end to end

```mermaid
flowchart TD
    META["Meta POSTs webhook"] --> SIG{"X-Hub-Signature-256 valid?"}
    SIG -- no --> U401["401"]
    SIG -- yes --> TEN{"Tenant found from<br/>phone_number_id?"}
    TEN -- no --> N404["404"]
    TEN -- yes --> REC["Save raw WebhookEvent"]
    REC --> ENQ["Enqueue processing job"] --> OK200["200 to Meta immediately"]

    ENQ -.-> JOB["Processing job parses payload"]
    JOB --> ST["Status updates"]
    JOB --> MSG["Inbound messages"]

    ST --> ST1{"Message with that<br/>WhatsApp id exists?"}
    ST1 -- no --> RT{"Attempt below 6?"}
    RT -- yes --> RS["Reschedule job<br/>5s, 15s, 30s, 60s, 120s"]
    RT -- no --> RF["Event marked Failed or Processed<br/>with an error note"]
    ST1 -- yes --> ST2["Advance status if allowed<br/>see section 5"]

    MSG --> D1{"Already recorded?"}
    D1 -- yes --> DUP["Skip, event may end as Duplicate"]
    D1 -- no --> C1{"Customer with this phone<br/>in this tenant?"}
    C1 -- no --> C2["Create customer<br/>Source Inbound, PendingOptIn"]
    C1 -- soft-deleted --> C3["Reactivate customer"]
    C1 -- yes --> OPT
    C2 --> OPT
    C3 --> OPT
    OPT{"OptOutDetector: exact keyword,<br/>or an opt-out phrase pattern?<br/>see section 6"}
    OPT -- yes --> OO["Customer = OptedOut<br/>OptOutSource records which layer"]
    OPT -- no --> CONV
    OO --> CONV["Get or create the customer's<br/>non-Closed conversation<br/>update LastInboundMessageAt"]
    CONV --> SAVE["Save inbound Message"]
    SAVE --> ISOPT{"Opt-out?"}
    ISOPT -- yes --> NOTIFY
    ISOPT -- no --> ORCH["ConversationOrchestrator<br/>section 2"]
    ORCH --> NOTIFY["SignalR: new inbound message<br/>to agents"]
```

An opt-out never reaches the AI and never raises a handoff; opting out is treated as the resolution.
A message the two deterministic layers do not catch still goes to the AI, which has its own opt-out
reading — see section 6.

## 2. AI orchestrator decision

```mermaid
flowchart TD
    IN["Inbound message saved"] --> MODE{"Conversation Mode"}
    MODE -- Human --> STOP["Do nothing more<br/>agent already notified"]
    MODE -- "AI or Hybrid, handled the same" --> KB["Retrieve relevant KB chunks<br/>see knowledge-base/FLOWS.md"]
    KB --> HIST["Load tenant AI options and<br/>last N messages of history"]
    HIST --> PLAN["Get or create active Lead<br/>Build qualification plan:<br/>what is known, what to ask next<br/>see leads/FLOWS.md"]
    PLAN --> Q{"AI conversation quota left?"}
    Q -- no --> QH["Conversation = Escalated<br/>Handoff, reason RuleTriggered"]
    Q -- yes --> AI["IAiService.GetResponse<br/>per-tenant prompt and tool schema"]
    AI --> VAL["Validate the reply<br/>leaks, score disclosure, ungrounded<br/>numbers, unknown fields"]
    VAL --> OO{"Model reported an opt-out?"}
    OO -- yes --> OO1["Customer = OptedOut<br/>OptOutSource = AiDetected"]
    OO -- no --> CAP
    OO1 --> CAP["Capture accepted field values<br/>Recompute lead score, hot-lead check"]
    CAP --> LOG["Save AiInteraction and cited sources<br/>Update conversation confidence,<br/>intent, summary and language"]
    LOG --> ESC{"Confidence below threshold,<br/>escalation intent, human requested,<br/>reply blocked, or lead is hot?"}
    ESC -- yes --> E1["Conversation = Escalated"]
    E1 --> E2["Build the briefing<br/>Get or create open Handoff<br/>see handoffs/FLOWS.md"]
    E2 --> E3["SignalR: new handoff"]
    ESC -- "no, but opted out" --> SILENT["Send nothing<br/>a promotional reply is the exact<br/>thing they asked us not to send"]
    ESC -- no --> R1["Save outbound Message Queued<br/>key ai:inboundId"]
    R1 --> R2["Send free text via WhatsApp"]
    R2 --> R3{"Sent?"}
    R3 -- yes --> R4["Message = Sent"]
    R3 -- no --> R5["Message = Failed<br/>Conversation = Escalated"]
    R5 --> R6["Get or create open Handoff<br/>reason RuleTriggered"]
    R6 --> E3
```

The AI is skipped **only** when Mode is `Human`. An `Escalated` conversation in AI mode is still answered
by the AI on the next inbound message.

Nothing the model returns is acted on before validation. The model judges, phrases and extracts; code
decides which field is asked next, what the turn is worth, whether the lead is hot, and whether the
reply may be sent at all.

## 3. Agent sends a message

```mermaid
flowchart TD
    A["Agent sends from conversation detail"] --> CL{"Conversation Closed?"}
    CL -- yes --> HIDE["UI hides the composer"]
    CL -- no --> OPT{"Customer OptedOut?"}
    OPT -- yes --> X1["409: nothing can be sent"]
    OPT -- no --> KIND{"Text or template?"}
    KIND -- text --> WIN{"Last inbound message within<br/>CustomerServiceWindowHours, default 24?"}
    WIN -- no --> X2["409: window closed, use a template"]
    WIN -- yes --> Q
    KIND -- template --> TP{"Template Approved and active?"}
    TP -- no --> X3["409"]
    TP -- yes --> RES["Fill placeholders from customer"] --> Q
    Q["Save Message Queued"] --> SEND["Send via WhatsApp"]
    SEND --> OK{"Sent?"}
    OK -- yes --> S["Message = Sent"]
    OK -- no --> F["Message = Failed<br/>no automatic retry for agent messages"]
```

The UI checks the 24-hour window with its own default; the API is the authority and re-checks with the
tenant's configured value.

## 4. Conversation status

```mermaid
stateDiagram-v2
    [*] --> Open : first inbound message or first campaign send
    Open --> Escalated : AI escalates, or AI reply fails to send
    Open --> Closed : agent closes
    Escalated --> Closed : agent closes
    Closed --> [*]
```

- Mode (`AI` / `Human` / `Hybrid`) and the assigned agent are set independently at any time until Closed.
- A Closed conversation is history. The customer's next message, or next campaign send, starts a new one.
- **Nothing moves `Escalated` back to `Open`.** Resolving the handoff does not change the conversation.

## 5. Message delivery status

```mermaid
stateDiagram-v2
    [*] --> Queued : saved before the API call
    Queued --> Sent
    Queued --> Delivered
    Queued --> Read
    Sent --> Delivered
    Sent --> Read
    Delivered --> Read
    Queued --> Failed
    Sent --> Failed
    Read --> [*]
```

Delivered and Read only arrive through status webhooks. Out-of-order or stale events that would move a
message backwards are ignored. Inbound messages are stored as `Delivered`.

## 6. Opt-out detection

Three layers, two of them deterministic and both in the webhook processor before any AI call.

```mermaid
flowchart TD
    T["Inbound message text"] --> L1{"Whole trimmed message is<br/>an exact keyword?<br/>stop · unsubscribe · unsub ·<br/>cancel · opt out · optout · quit"}
    L1 -- yes --> S1["OptedOut, source ExactKeyword"]
    L1 -- no --> L2{"First 400 characters match<br/>an opt-out phrase pattern?<br/>don't message me · remove me ·<br/>no more messages · mat bhejo ·<br/>band karo ye messages"}
    L2 -- yes --> S2["OptedOut, source PhrasePattern"]
    L2 -- no --> AI["Message goes to the AI turn"]
    AI --> L3{"Model reported an opt-out?"}
    L3 -- yes --> S3["OptedOut, source AiDetected<br/>reply suppressed"]
    L3 -- no --> N["Not an opt-out"]
```

- **Why the model is trusted here.** A false positive stops promotional messages to someone who may
  not have asked. A false negative keeps sending to someone who did, which is a compliance violation.
  Those are not equal, so this leans toward detecting. The same reasoning would not justify trusting
  the model with a flag that *removed* a restriction.
- **Leaning toward detection is not loose matching.** Every phrase pattern is anchored on "me" or on a
  messaging noun, because this runs inside a sales conversation: "3BHK nahi chahiye" is a customer
  narrowing their requirement, not leaving, and opting them out over it would be worse than useless.
- **Why the source is recorded.** `Customer.OptOutSource` answers the compliance question "did they
  really ask us to stop?", and marks the AI-detected ones as the only non-deterministic path — the
  ones worth spot-checking. `Manual` covers an agent setting it on the customer record, or an import.
- **Nothing is sent after an opt-out**, not even an acknowledgement. The design allows a fixed
  acknowledgement template as a tenant option; it is not built, and silence is the safer default.
