# Leads — flows

How leads are created and scored by the AI, and what agents can change. All charts are traced from the
code. Index of every module's charts: [docs/MODULE-FLOWS.md](../../../../docs/MODULE-FLOWS.md).

| Where the logic lives | File |
| --- | --- |
| UI rules | [lead.model.ts](../../core/models/lead.model.ts) — `canEditLead` |
| HTTP calls | [lead.service.ts](../../core/services/lead.service.ts) |
| Creation and scoring (API) | `AI-Sales-Automation-System-api/.../Application/Leads/LeadService.cs` |
| Caller (API) | `.../Application/Ai/ConversationOrchestrator.cs` |

---

## 1. AI turn updates the lead

```mermaid
flowchart TD
    T["AI turn on a conversation<br/>Mode AI or Hybrid"] --> G{"Customer has a lead that is<br/>not Won or Lost?"}
    G -- yes --> L["Use it"]
    G -- no --> N["Create lead<br/>Stage New, score 0"]
    L & N --> M["Merge AI-extracted fields<br/>Budget, Interest, PurchaseTimeline<br/>blank values never erase old ones"]
    M --> S["Compute score"]
    S --> S1["+30 Budget known<br/>+30 Interest known<br/>+20 PurchaseTimeline known"]
    S1 --> S2{"Detected intent"}
    S2 -- Negotiation --> P["+20"]
    S2 -- Complaint --> Q["-20"]
    S2 -- other --> Z["+0"]
    P & Q & Z --> C["Clamp to 0..100"]
    C --> B{"Score"}
    B -- "70 or more" --> HOT["Hot"]
    B -- "40 to 69" --> WARM["Warm"]
    B -- "below 40" --> COLD["Cold"]
    HOT & WARM & COLD --> CH{"Score changed?"}
    CH -- yes --> A1["Activity: ScoreChanged"]
    CH -- no --> ST
    A1 --> ST{"Stage New and any field known?"}
    ST -- yes --> A2["Stage = Qualifying<br/>Activity: StageChanged"]
    ST -- no --> END1
    A2 --> END1["Conversation.LastLeadScore = band<br/>shown as the chip in the inbox"]
```

AI-written activities have no `createdBy`; agent notes and edits carry the agent's id.

## 2. Stages

```mermaid
stateDiagram-v2
    [*] --> New : created on first AI turn
    New --> Qualifying : AI extracts any attribute
    Qualifying --> Qualified : agent
    Qualified --> Negotiation : agent
    Negotiation --> Won : agent
    Negotiation --> Lost : agent
    Won --> [*]
    Lost --> [*]
```

- Only **New → Qualifying** is automatic. Every other move is an agent's edit, and the API allows any stage
  to any stage; the chart shows the normal forward path.
- The UI hides editing on Won and Lost leads (the API does not block it).
- Once a lead is Won or Lost, the customer's next AI turn starts a **new** lead.

## 3. Agent actions

```mermaid
flowchart LR
    D["Lead detail"] --> E["Edit stage, budget,<br/>interest, timeline"]
    D --> AS["Assign to agent"]
    D --> NT["Add note"]
    E & AS & NT --> TL["Activity timeline"]
```
