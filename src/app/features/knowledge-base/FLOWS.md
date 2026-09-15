# Knowledge base — flows

How an article becomes something the AI can quote, and how it's found at reply time. All charts are
traced from the code. Index of every module's charts: [docs/MODULE-FLOWS.md](../../../../docs/MODULE-FLOWS.md).

| Where the logic lives | File |
| --- | --- |
| UI rules and provider names | [knowledge-base.model.ts](../../core/models/knowledge-base.model.ts) — `canPublishArticle` |
| HTTP calls | [knowledge-base.service.ts](../../core/services/knowledge-base.service.ts) |
| Publish, embed, retrieve (API) | `AI-Sales-Automation-System-api/.../Application/KnowledgeBase/KnowledgeBaseService.cs` |
| Caller at reply time (API) | `.../Application/Ai/ConversationOrchestrator.cs` |

Two separate switches decide whether the AI can use an article:

1. **Embedded** — the article is `Published`, split into chunks, and each chunk has a vector.
2. **Published to a chat model** — ChatGPT, Gemini or Claude is allowed to use it.

---

## 1. Article lifecycle

```mermaid
flowchart TD
    C["Create article"] --> D["Status Draft<br/>not usable by the AI"]
    D --> ED["Edit content"]
    ED --> V["Version + 1<br/>existing chunks are NOT rebuilt"]
    V --> ED
    D --> PUB
    V --> PUB{"Publish"}
    PUB -- "no provider chosen" --> ALL["Split into chunks, 800 chars max,<br/>by paragraph then by word<br/>Embed with the embedding service"]
    ALL --> PBD["Status Published<br/>ApprovedBy set"]
    PUB -- "one embedding provider" --> K{"Provider has an API key?"}
    K -- no --> X["400"]
    K -- yes --> ST{"No chunks yet, or chunks<br/>older than current Version?"}
    ST -- yes --> RC["Rebuild chunks,<br/>drop every provider's old vectors"]
    ST -- no --> EMB
    RC --> EMB["Embed with that provider only"]
    PBD --> MOD
    EMB --> MOD{"Publish to chat model<br/>ChatGPT, Gemini, Claude"}
    MOD --> MK{"Model has an API key?"}
    MK -- no --> X
    MK -- yes --> MP["Publish article first if still Draft<br/>Record model publication"]
    MP --> UN["Unpublish from model<br/>removes that publication only"]
```

- **Reindex** re-embeds every Published article whose chunks are older than its current Version. Use it
  after editing live articles.
- **Bulk publish** runs one article at a time and reports not-found and failed ids instead of failing the
  whole call.
- `Archived` exists but no action sets it, so there's nothing to un-archive.

## 2. Retrieval at reply time

```mermaid
flowchart TD
    Q["Customer message text"] --> E0{"Empty?"}
    E0 -- yes --> NONE["No grounding"]
    E0 -- no --> EMB["Embed the message"]
    EMB --> AP{"Active chat provider is a<br/>real model, not Simulated?"}
    AP -- yes --> F1["Candidates: chunks of Published articles<br/>published to that model"]
    AP -- no --> F2["Candidates: chunks of all<br/>Published articles"]
    F1 & F2 --> COS["Cosine similarity in memory"]
    COS --> TH["Keep score at or above MinRelevanceScore"]
    TH --> TOP["Top KnowledgeBaseTopN by score"]
    TOP --> OR["Passed to the AI as grounding<br/>cited chunks are saved with the AI turn"]
```

An article that is Published but not published to the active chat model is **not** retrieved in
production. It is only visible to the AI when the Simulated provider is active.
