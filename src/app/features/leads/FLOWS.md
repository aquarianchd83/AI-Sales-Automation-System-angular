# Leads — flows

How leads are created and scored by the AI, and what agents can change. All charts are traced from the
code. Index of every module's charts: [docs/MODULE-FLOWS.md](../../../../docs/MODULE-FLOWS.md).

| Where the logic lives | File |
| --- | --- |
| UI rules | [lead.model.ts](../../core/models/lead.model.ts) — `canEditLead` |
| HTTP calls | [lead.service.ts](../../core/services/lead.service.ts) |
| Creation and agent edits (API) | `AI-Sales-Automation-System-api/.../Application/Leads/LeadService.cs` |
| What to ask next, and capture (API) | `.../Application/Leads/QualificationPlanner.cs` |
| Scoring (API) | `.../Application/Leads/LeadScoringService.cs` |
| Configuration (API) | `.../Application/Leads/QualificationAdminService.cs`, `LeadScoringAdminService.cs` |
| Caller (API) | `.../Application/Ai/ConversationOrchestrator.cs` |

---

## 1. AI turn updates the lead

The three hardcoded attributes are gone. Each tenant configures its own qualification questions and
its own scoring rules, and the model never decides what anything is worth — it reports what happened,
and code prices it.

```mermaid
flowchart TD
    T["AI turn on a conversation<br/>Mode AI or Hybrid"] --> G{"Customer has a lead that is<br/>not Won or Lost?"}
    G -- yes --> L["Use it"]
    G -- no --> N["Create lead<br/>Stage New, score 0"]
    L & N --> PLAN["Build the plan:<br/>this tenant's questions,<br/>what this lead already answered,<br/>the next few to ask"]
    PLAN --> HOT0{"Lead already marked hot?"}
    HOT0 -- yes --> PAUSE["Ask nothing<br/>questions withheld from the prompt"]
    HOT0 -- no --> ASK["Questions go into the prompt"]
    PAUSE & ASK --> AI["AI turn, then output validation"]
    AI --> CAP["Capture the accepted values<br/>below the confidence floor: recorded,<br/>but not treated as an answer"]
    CAP --> SUP["A new answer supersedes the old one<br/>the old row is kept"]
    SUP --> SC["Recompute the score"]
```

## 1a. How the score is built

```mermaid
flowchart TD
    S["Recompute"] --> W["Award the weight of every<br/>configured question now answered<br/>that has not been awarded yet"]
    W --> R["Evaluate the tenant's scoring rules<br/>against this turn's signals"]
    R --> R1{"Rule type"}
    R1 -- "intent match" --> C1["Contribution"]
    R1 -- "keyword in the message" --> C1
    R1 -- "field has a given value" --> C1
    C1 --> ONCE{"Rule is once-per-lead<br/>and already earned?"}
    ONCE -- yes --> SKIP["Skip"]
    ONCE -- no --> ADD["Record a LeadScoreContribution"]
    SKIP & ADD --> SUM["Score = sum of every contribution,<br/>clamped 0..100"]
    SUM --> B{"Band"}
    B -- "70 or more" --> HOT["Hot"]
    B -- "40 to 69" --> WARM["Warm"]
    B -- "below 40" --> COLD["Cold"]
    HOT & WARM & COLD --> MARK{"A rule marked this lead hot?"}
    MARK -- yes --> STAMP["Stamp HotLeadDetectedAt and the reason<br/>once; never cleared"]
    MARK -- no --> CH
    STAMP --> CH{"Score changed?"}
    CH -- yes --> A1["Activity: ScoreChanged"]
    CH -- no --> END1
    A1 --> END1["Conversation.LastLeadScore = band<br/>shown as the chip in the inbox"]
```

- **Contributions accumulate; they are not recomputed from scratch each turn.** A signal once earned
  stays earned. The old heuristic re-derived the intent bonus every turn, so a lead that negotiated
  and then asked something harmless silently lost it.
- **Every contribution is stored with the rule or field that produced it.** A score nobody can take
  apart is one the sales team learns to ignore, which is also why it travels with the handoff
  briefing and why `LeadScoreContribution` exists as a table.
- **The hot mark is permanent, the band is current state.** A lead can read Cold today and still be
  one the rules fired on last week; the agent performance report counts them separately for that
  reason.

AI-written activities have no `createdBy`; agent notes and edits carry the agent's id.

## 2. Stages

```mermaid
stateDiagram-v2
    [*] --> New : created on first AI turn
    New --> Qualifying : first qualification value captured
    Qualifying --> Qualified : agent
    Qualified --> Negotiation : agent
    Negotiation --> Won : agent
    Negotiation --> Lost : agent
    Won --> [*]
    Lost --> [*]
```

- Only **New → Qualifying** is automatic, and it happens where capture happens, not where scoring
  does. Every other move is an agent's edit, and the API allows any stage to any stage; the chart
  shows the normal forward path.
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

## 4. Is any of it working?

Configuration this open needs a way to tell whether a question earns its place. **Agent Performance**
(Workspace → Agent Performance, Admin only) answers that from what the orchestrator already records:

- **Ask effectiveness** per question — asked in 80 conversations and answered in 12 is a badly phrased
  question, not a stubborn customer. Values the customer volunteered before being asked are counted
  separately, since they prove nothing about the question.
- **Turns to answer** — a question that takes four turns is costing the conversation its patience.
- **Hot conversion against everyone else** — if leads the rules mark hot do not close better than the
  rest, the rules are measuring something that is not buying intent, and the fix is in the rules.
