# PRD Package Plan: Mac-First Local LLM Gateway

## Summary
Create a multi-document PRD set for a **Mac-first desktop app** that bundles a local control plane, a local OpenAI-compatible gateway, one document-based knowledge assistant, and a **built-in remote relay** so the user can call their home device from another machine. The PRDs should optimize for **solo developers first**, require **email login**, and keep the first release decision-complete without adding team-grade complexity beyond what the relay and auth require.

**Implementation defaults to lock into the PRDs**
- Desktop shell: `Tauri`
- Desktop UI: `React + Vite + TypeScript`
- Embedded local backend: `FastAPI`
- Local metadata store: `SQLite`
- Local vector store: `sqlite-vec` or equivalent SQLite-native vector extension
- File storage: local app-managed filesystem directory
- Inference backend: `Ollama` only in v1
- Cloud components for MVP: hosted auth + device registry + relay broker only
- Platforms: macOS first; Windows explicitly out of scope for the PRDs except for future-compat notes

## PRD Set To Produce
1. `specs/prd/00-local-llm-desktop-overview.md`
- Define product architecture, dependency map, implementation order, feature flags, and how the desktop app, local service, and hosted relay interact.
- Lock terminology: `user`, `device`, `workspace`, `API key`, `assistant`, `document`, `chunk`, `request log`, `relay session`.
- State that v1 is single-user-per-install with one owner workspace, but the cloud layer exists for auth and remote access.

2. `specs/prd/P0-desktop-shell-and-first-run-onboarding.md`
- Cover install, first-launch flow, email login, Ollama detection, local service boot, health checks, default model selection, and first API key creation.
- Specify all UI states: no Ollama installed, Ollama unreachable, no models present, local service failed, login failed, relay disconnected.
- Include desktop tray/menu behavior, app startup behavior, and recovery flows after reboot.

3. `specs/prd/P0-auth-device-registration-and-remote-relay.md`
- Cover hosted auth, device registration, session lifecycle, outbound tunnel establishment, relay routing, device online/offline rules, and remote security boundaries.
- Define device trust model: one signed-in owner can register the device; remote clients call hosted API; hosted relay forwards only to active authenticated device sessions.
- Specify exact failure handling for expired login, revoked device, stale relay session, duplicate device name, and unreachable local agent.

4. `specs/prd/P0-local-gateway-and-api-keys.md`
- Cover local API key lifecycle, OpenAI-compatible endpoints, request routing to Ollama, model listing, streaming, request logging, and key scoping.
- Include both local endpoint usage and remote endpoint usage through relay.
- Define which OpenAI-compatible surfaces are in scope: `/v1/models`, `/v1/chat/completions`, `/v1/embeddings`; everything else out of scope.

5. `specs/prd/P0-knowledge-assistant-rag.md`
- Cover assistant creation, file upload, parsing, chunking, embeddings, retrieval, answer generation, citation rendering, and assistant-scoped API/chat usage.
- Lock v1 sources to local uploaded files only: `PDF`, `Markdown`, `TXT`, `DOCX`.
- Specify “answer from sources or say you don’t know” behavior, citation format, document processing states, and re-index workflow.

6. `specs/prd/P1-observability-playground-and-model-settings.md`
- Cover request logs, request detail view, latency/status display, model settings, assistant test playground, and operational diagnostics.
- Keep this after the P0 flow is stable; it improves trust and debugging but does not block first end-to-end usage.

## Public Interfaces, Data Contracts, and Product Boundaries
**External APIs that the PRDs should lock**
- Local API base: `http://127.0.0.1:<assigned-port>/v1`
- Remote API base: `https://api.<product-domain>/v1`
- OpenAI-compatible routes:
  - `GET /v1/models`
  - `POST /v1/chat/completions`
  - `POST /v1/embeddings`

**Desktop/local control-plane interfaces**
- Local service health endpoint for UI bootstrapping
- Local auth/session sync endpoint used by the desktop shell after hosted login
- Assistant/document CRUD endpoints used only by the desktop UI
- Relay status endpoint used by the UI to show `Connected`, `Reconnecting`, `Offline`, `Auth Required`

**Core entities the PRDs should define**
- `User`: hosted identity record
- `Device`: one registered desktop installation
- `Workspace`: one owner workspace per install in v1
- `ApiKey`: hashed secret, label, scope, last used timestamp, revoked state
- `ModelConfig`: Ollama model name, default state, embedding/chat capability flags
- `RequestLog`: timestamp, endpoint, model, latency, token estimates, origin (`local` or `remote`), status, error code
- `Assistant`: name, prompt, default model, retrieval settings
- `Document`: source file metadata, processing state, checksum, assistant linkage
- `Chunk`: embedded text segment with document reference and retrieval metadata
- `RelaySession`: device connectivity state, last heartbeat, tunnel state

**Explicit out-of-scope boundaries for the PRDs**
- No fine-tuning
- No Slack/Discord/web connectors
- No multi-provider routing
- No team collaboration beyond the hosted auth/device groundwork
- No billing implementation
- No Windows implementation details beyond future notes
- No mobile client
- No public port exposure to Ollama or the local gateway

## Test Plan and Acceptance Scenarios
**Desktop shell and onboarding**
- Given a new Mac install with Ollama running and at least one model present, when the user signs in and completes onboarding, then the app starts the local service, registers the device, shows relay connected, and issues a first API key.
- Given Ollama is not installed, when the app launches, then onboarding blocks API usage and shows an install action with retry.
- Given Ollama is installed but has no usable models, when setup reaches model selection, then the UI shows an empty state and disables completion until a supported model is present.

**Auth and relay**
- Given the user is signed in and the device is online, when a remote client sends a valid request to the hosted endpoint, then the relay forwards it to the local gateway and returns the streamed response.
- Given the device is offline, when a remote client sends a request, then the API returns a deterministic offline error and logs the failed attempt.
- Given the login session expires, when the desktop app attempts to refresh relay connectivity, then relay state becomes `Auth Required` and remote requests fail closed.

**Local gateway and API keys**
- Given a valid local API key, when a project calls `POST /v1/chat/completions`, then the gateway validates the key, routes to Ollama, streams the response, and writes a request log row.
- Given a revoked or invalid key, when any `/v1/*` endpoint is called, then the gateway returns unauthorized and logs the failure without touching Ollama.
- Given an embeddings request against a model without embeddings capability, when the request arrives, then the API returns a capability error with a clear message and no retry loop.

**Knowledge assistant**
- Given a new assistant and valid documents, when indexing completes, then assistant chat retrieves matching chunks and returns an answer with at least one citation when relevant evidence exists.
- Given retrieval confidence is weak or no relevant chunks exist, when the user asks a question, then the assistant responds with an explicit “I don’t know based on the uploaded sources” style answer.
- Given a large or malformed file, when upload or parsing fails, then the document enters `Failed` state with a visible retry path and the failure is logged.

**Observability and diagnostics**
- Given successful and failed requests, when the user opens the logs screen, then they can filter by endpoint, origin, model, assistant, and status.
- Given a single request detail entry, when opened, then the UI shows request metadata, relay/local origin, model used, latency, token estimate, and any assistant citations involved.

## Assumptions and Defaults
- Product name and domain are not yet locked; PRDs should use a neutral placeholder consistently.
- v1 is **desktop-first**, not browser-first SaaS.
- v1 uses **email login** because remote relay and device ownership require a hosted identity.
- v1 uses **one local owner workspace per installation**; no shared multi-user workspace flows yet.
- v1 remote access is **built in**, implemented as an outbound device tunnel plus hosted relay broker, not raw inbound networking.
- v1 supports only **local file ingestion** for knowledge assistants.
- v1 supports only **Ollama** and a curated supported-model list.
- If a technical choice is not already fixed elsewhere, the PRDs should prefer the simplest path compatible with a polished Mac app and future hosted expansion, not the most abstract architecture.
