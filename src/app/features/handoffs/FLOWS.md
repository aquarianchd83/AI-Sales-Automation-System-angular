# Handoffs — flows

How a conversation gets handed from the AI to a human agent, and how the agent works it. All charts are
traced from the code. Index of every module's charts:
[docs/MODULE-FLOWS.md](../../../../docs/MODULE-FLOWS.md).

| Where the logic lives | File |
| --- | --- |
| UI rules | [handoff.model.ts](../../core/models/handoff.model.ts) — `canClaimHandoff`, `canResolveHandoff` |
| HTTP calls | [handoff.service.ts](../../core/services/handoff.service.ts) |
| Raised by (API) | `AI-Sales-Automation-System-api/.../Application/Ai/ConversationOrchestrator.cs` |
| Claim / resolve (API) | `.../Application/Handoffs/HandoffService.cs` |

---

## 1. End to end

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant WA as WhatsApp / Meta
    participant WH as Webhook processor
    participant OR as AI orchestrator
    participant HS as HandoffService
    participant RT as SignalR
    actor Agent

    Customer->>WA: sends message
    WA->>WH: webhook
    WH->>OR: handle inbound message
    OR->>OR: AI turn, low confidence or escalation intent
    OR->>HS: get or create open handoff
    alt conversation already has an unresolved handoff
        HS-->>OR: existing handoff, no duplicate
    else none open
        HS-->>OR: new handoff, Pending
    end
    OR->>RT: new handoff event
    RT-->>Agent: handoff appears in the queue
    Agent->>HS: claim
    HS-->>Agent: Assigned to this agent
    Agent->>WA: replies from the conversation screen
    Agent->>HS: resolve with notes
    HS-->>Agent: Resolved
```

## 2. When a handoff is raised

```mermaid
flowchart TD
    T["Inbound message, conversation Mode is AI or Hybrid"] --> AI["AI turn"]
    AI --> E{"Confidence below ConfidenceThreshold,<br/>or intent in EscalationIntents?"}
    E -- no --> SEND["AI reply sent"]
    SEND --> OK{"Send succeeded?"}
    OK -- yes --> NONE["No handoff"]
    OK -- no --> RULE["Reason = RuleTriggered<br/>notes: AI reply failed to send"]
    E -- yes --> MAP{"Detected intent"}
    MAP -- complaint --> R1["Complaint"]
    MAP -- negotiation --> R2["Negotiation"]
    MAP -- complextechnical --> R3["ComplexTechnical"]
    MAP -- humanrequest --> R4["CustomerRequested"]
    MAP -- anything else --> R5["LowConfidence"]
    R1 & R2 & R3 & R4 & R5 --> OPEN
    RULE --> OPEN{"Conversation already has<br/>an unresolved handoff?"}
    OPEN -- yes --> REUSE["Reuse it"]
    OPEN -- no --> NEW["Create handoff, Pending"]
    REUSE & NEW --> ESC["Conversation = Escalated<br/>SignalR notify"]
```

Handoffs are never raised for: Human-mode conversations, opt-out keywords, or agent-sent messages.
`CannotAnswer` exists in the enum but no intent maps to it.

## 3. Handoff status

```mermaid
stateDiagram-v2
    [*] --> Pending : raised by orchestrator
    Pending --> Assigned : claim
    Assigned --> Assigned : claimed again, reassigns
    Pending --> Resolved : resolve
    Assigned --> Resolved : resolve, optional notes
    Resolved --> [*]
```

- The queue lists Pending first, then Assigned, Resolved last; oldest first within each.
- A Resolved handoff cannot be claimed (409). Claim and Resolve are offered for anything not yet Resolved.
- **`InProgress` is never set** by any code path.

> **What resolving does not do:** the conversation stays `Escalated` and keeps its Mode. If the Mode is
> still `AI`, the AI answers the customer's next message. To stop the AI while a person handles it, switch
> the conversation to `Human` from the conversation screen.
