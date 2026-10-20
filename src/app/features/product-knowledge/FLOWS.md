# Product knowledge - flows

What the AI knows about a tenant's products comes from three inputs only: **documents**, the **website**, and **answers the tenant types or edits**. The tenant no longer writes knowledge-base articles; those screens are gone from the tenant app (the endpoints, ingestion, vector stores, retrieval and the platform admin's Global knowledge stay).

## From sources to chat

```mermaid
flowchart LR
    DOC[Documents] & WEB[Website] --> PASS[Source passages]
    PASS -- "embedded when a source is Ready" --> SRC[("SOURCE index<br/>drafting only")]
    SRC --> DRAFT[Drafted answers<br/>words + meaning, verified quotes]
    TYPED[Answers the tenant types] --> APPROVE
    DRAFT --> APPROVE[Tenant approves]
    APPROVE --> PUB[Publish / restore a version]
    PUB -- "approved, eligible items only" --> SERVE[("SERVING index<br/>system article + chunks")]
    SERVE -- "tenant switch ON" --> CHAT[Customer chat]
```

The two indexes never mix: the source index is read only when drafting; chat reads only the serving index.

## Publishing and the chat index

```mermaid
sequenceDiagram
    participant T as Tenant admin
    participant P as Publishing
    participant I as Serving indexer
    participant K as Ingestion pipeline
    T->>P: Publish (or restore a version)
    P->>P: save the version (immutable items)
    P->>I: build the chat index
    I->>K: render items as sections, publish the system article
    alt indexing finishes
        K-->>I: chunks swapped in atomically
        I-->>P: version is Live (older Live becomes Replaced)
    else it fails
        I-->>P: version is Failed with a reason
        Note over P,K: the publish stands; chat keeps the last Live version; Try again rebuilds it
    end
```

## What chat does

```mermaid
flowchart TD
    MSG[Customer message] --> SW{Tenant switch<br/>set by platform admin}
    SW -- OFF --> OLD[Knowledge base articles, as before]
    SW -- ON --> RET[Retrieve from the tenant's published chunks<br/>lapsed price / guarantee claims dropped]
    RET --> ANY{Anything relevant?}
    ANY -- yes --> ANS[Answer; a material claim must be stated by an approved item;<br/>citation keeps item and version]
    ANY -- no --> Q{Asked a clarifying question<br/>on the previous turn too?}
    Q -- no --> ASK[One clarifying question only]
    Q -- yes --> HAND[Handoff to a person]
```

## Test chat

The tenant can talk to the AI as a customer would, from **Test Chat**. It reads the live published version (whether or not live chat is switched over) with live chat's own retrieval, prompt and safety checks, and stores and sends nothing.

```mermaid
sequenceDiagram
    participant T as Tenant (as a customer)
    participant C as Test chat
    participant K as Published chunks
    participant A as AI
    T->>C: message + the conversation so far
    C->>K: search with this and earlier customer messages
    C->>A: reply using only what was found
    A-->>C: draft
    C->>C: same safety checks as live chat
    alt answered
        C-->>T: reply + which approved answers were used
    else nothing covers it
        C-->>T: one clarifying question (a second miss hands over)
    else a check fails / person needed
        C-->>T: note: a person would take over, and what the AI tried to say
    end
```
