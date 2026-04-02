# Product Brief: Local LLM Gateway

**Date:** 2026-03-31
**Status:** Ready for PRD
**Author:** Product Manager Agent

---

## Vision
A developer or small company can run local or self-hosted language models behind a polished, secure, OpenAI-compatible gateway and use them across apps with one API key. The product should feel like a serious developer platform, not a hobby wrapper around Ollama.

## Problem
Students, indie developers, and privacy-sensitive teams want LLM capabilities without recurring API bills or vendor lock-in. Today they either:

- call expensive cloud APIs directly
- run Ollama locally with poor sharing and no team controls
- stitch together ad hoc scripts for RAG, auth, logging, and UI

Companies also want domain-specific chatbots over their own documents, but they usually do not need model training first. They need reliable retrieval, tenant isolation, and observable answer quality.

## Validation

### Feasibility
| Check | Result | Notes |
|-------|--------|-------|
| Tech stack supports it | ✅ | Greenfield project; no existing constraints in repo |
| Core model hosting exists | ✅ | Ollama and other local runtimes already solve inference |
| OpenAI-compatible API is feasible | ✅ | Well-scoped REST + streaming surface |
| Knowledge chatbot support is feasible | ✅ | RAG is the right first approach, not custom training |
| Remote multi-device access is feasible | ⚠️ | Must use secure networking and auth, not raw port exposure |
| Enterprise-grade scale is feasible | ⚠️ | Requires queueing, worker separation, observability, and multi-tenant data boundaries |

### User Segments
1. Student developers who need low-cost LLM access for side projects.
2. Indie hackers who want one API across local and cloud backends.
3. Small companies that want private, branded knowledge assistants.
4. Developer teams building internal AI tools without immediate cloud spend.

### Why This Matters
The low-end LLM tooling market is crowded, but most tools are fragmented:

- model runners focus on inference, not platform UX
- chatbot builders focus on no-code workflows, not developer APIs
- cloud providers focus on hosted usage, not local-first control

There is a credible gap for a product that combines:

- local-first model serving
- developer-grade API compatibility
- clean team UI
- built-in knowledge assistants

## Product Strategy

### Positioning
**Not:** "Free GPT clone"

**Instead:** "A local-first AI gateway for developers and teams, with secure API access and private knowledge assistants."

### Product Pillars
1. **Gateway**: OpenAI-compatible API over local and self-hosted models.
2. **Control Plane**: Keys, rate limits, logs, model routing, usage tracking.
3. **Knowledge Layer**: Document ingestion, retrieval, citations, tenant-scoped assistants.
4. **Team UX**: Admin dashboard, assistant builder, evaluation and debugging views.

## Recommended Scope

### MVP
1. User connects local Ollama instance.
2. Product exposes:
   - `/v1/models`
   - `/v1/chat/completions`
   - `/v1/embeddings`
3. User can create and revoke API keys.
4. Dashboard shows requests, tokens, latency, failures.
5. User can create one knowledge assistant:
   - upload files
   - index documents
   - chat with citations

### V2
1. Multiple providers and model backends.
2. Teams, workspaces, and role-based access.
3. Share assistants across users.
4. Evaluation suite for answer quality.
5. Webhook and SDK support.

### Later
1. Agent workflows and tool calling.
2. Prompt/version management.
3. Fine-tuning orchestration for advanced users.
4. Hybrid local + cloud routing policies.

## Non-Goals
- Building a new model runtime from scratch.
- Competing immediately with enterprise AI orchestration suites.
- Leading with fine-tuning as the main customization method.
- Supporting every provider in v1.

## Key Product Decision

### Custom Training vs Knowledge Base
For company-specific Q&A, start with **RAG**, not fine-tuning.

Use fine-tuning only later for narrow cases like:

- tone/style adaptation
- structured extraction patterns
- classification tasks with labeled data

For factual company answers, the better system is:

1. ingest documents
2. chunk and embed them
3. retrieve relevant chunks per query
4. answer with citations
5. enforce tenant-specific access

This is faster to ship, easier to update, cheaper to maintain, and more trustworthy.

## High-Level Architecture

### Core Services
1. **API Gateway**
   - auth
   - API keys
   - request validation
   - OpenAI-compatible endpoints
   - streaming responses

2. **Inference Router**
   - route to Ollama or future providers
   - model capability registry
   - fallback rules

3. **Knowledge Service**
   - file ingestion
   - parsing
   - chunking
   - embedding
   - retrieval
   - citation formatting

4. **Worker Queue**
   - background indexing
   - large document processing
   - retry handling

5. **Control Plane UI**
   - keys
   - models
   - assistants
   - usage
   - logs

### Storage
- Postgres for users, keys, assistants, documents, audit data
- Object storage for uploaded files
- Vector store via Postgres + pgvector for v1
- Redis for queues, caching, and rate limiting

## UX Direction
The product should look like a serious B2B developer tool:

- clean information density
- fast navigation
- dark/light support if polished, not by default
- evidence-first chat UI with citations and source panels
- model and cost visibility on every request path

Primary screens:

1. Overview dashboard
2. API keys
3. Models
4. Assistants
5. Documents
6. Logs and traces
7. Playground

## Security and Trust
This is the make-or-break area.

Required baseline:

- hashed API keys
- scoped permissions
- workspace isolation
- per-assistant access control
- audit logs
- HTTPS-only remote access
- optional Tailscale/Cloudflare Tunnel guidance
- prompt injection mitigation for retrieved content

## Success Metrics

### MVP Metrics
- Time to first successful API call < 10 minutes
- Time to first assistant answer < 15 minutes
- 80%+ of retrieved-answer sessions include at least one citation
- p95 chat latency under an acceptable threshold for selected local models

### Business Metrics
- Weekly active projects using issued keys
- Assistants created per workspace
- Document ingestion success rate
- 30-day retention for active users

## Risks
1. Local inference quality may disappoint users expecting frontier models.
2. Remote exposure can become a security liability if made too easy.
3. Knowledge assistant accuracy will fail without retrieval quality and evals.
4. Hardware variation makes user experience inconsistent.

## Recommendation
Build this as a **developer platform with embedded RAG**, not as "custom-trained local AI." The strongest launch story is:

"Connect Ollama, get one compatible API, then spin up private knowledge assistants over your documents."

That gives you a practical student-friendly wedge and a path toward team adoption.

## Next Step for PRD
Feed this brief to `prd-architect` to turn it into implementation-ready PRDs for:

1. Core gateway and auth
2. Knowledge assistant pipeline
3. Admin dashboard and UX
