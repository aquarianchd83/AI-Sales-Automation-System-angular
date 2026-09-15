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
    OPT{"Text is exactly an opt-out word?<br/>stop, unsubscribe, unsub,<br/>cancel, opt out, optout, quit"}
    OPT -- yes --> OO["Customer = OptedOut"]
    OPT -- no --> CONV
    OO --> CONV["Get or create the customer's<br/>non-Closed conversation<br/>update LastInboundMessageAt"]
    CONV --> SAVE["Save inbound Message"]
    SAVE --> ISOPT{"Opt-out?"}
    ISOPT -- yes --> NOTIFY
    ISOPT -- no --> ORCH["ConversationOrchestrator<br/>section 2"]
    ORCH --> NOTIFY["SignalR: new inbound message<br/>to agents"]
```

An opt-out never reaches the AI and never raises a handoff; opting out is treated as the resolution.

## 2. AI orchestrator decision

```mermaid
flowchart TD
    IN["Inbound message saved"] --> MODE{"Conversation Mode"}
    MODE -- Human --> STOP["Do nothing more<br/>agent already notified"]
    MODE -- "AI or Hybrid, handled the same" --> KB["Retrieve relevant KB chunks<br/>see knowledge-base/FLOWS.md"]
    KB --> HIST["Load tenant AI options and<br/>last N messages of history"]
    HIST --> AI["IAiService.GetResponse<br/>reply text, intent, confidence,<br/>extracted entities, cited chunks"]
    AI --> LOG["Save AiInteraction and cited sources<br/>Update conversation confidence,<br/>intent and summary"]
    LOG --> LEAD["Get or create active Lead,<br/>apply extracted attributes, rescore<br/>see leads/FLOWS.md"]
    LEAD --> ESC{"Confidence below threshold,<br/>or intent in EscalationIntents?"}
    ESC -- yes --> E1["Conversation = Escalated"]
    E1 --> E2["Get or create open Handoff<br/>reason mapped from intent"]
    E2 --> E3["SignalR: new handoff"]
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
