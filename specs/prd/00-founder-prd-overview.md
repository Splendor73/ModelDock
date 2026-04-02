# ModelDock — Founder PRD

**Version:** 1.0
**Date:** 2026-03-31
**Author:** Founder
**Status:** Ready for Implementation

---

## Table of Contents

1. [What Is ModelDock](#1-what-is-modeldock)
2. [Why This Exists](#2-why-this-exists)
3. [Who It's For](#3-who-its-for)
4. [Product Architecture](#4-product-architecture)
5. [Technology Stack](#5-technology-stack)
6. [Data Model](#6-data-model)
7. [Phase 1 Feature List](#7-phase-1-feature-list)
8. [Phase 1 Build Order](#8-phase-1-build-order)
9. [Phase 2 and Beyond](#9-phase-2-and-beyond)
10. [Security Baseline](#10-security-baseline)
11. [Success Metrics](#11-success-metrics)
12. [Risks and Mitigations](#12-risks-and-mitigations)
13. [Non-Goals](#13-non-goals)

---

## 1. What Is ModelDock

ModelDock is a **Mac-first desktop application** that turns a local Ollama installation into a proper developer platform. It provides:

- An **OpenAI-compatible API** over local models, so any app that works with OpenAI can work with your local models by changing one URL
- **API key management** with hashed storage, scoping, and revocation — like a real cloud provider
- **Usage logging and observability** so you can see every request, its latency, tokens, and errors
- **Private knowledge assistants** that answer questions from your uploaded documents with citations
- **Built-in remote access** via a secure relay, so you can call your home machine's models from anywhere

It is not a chatbot builder. It is not a free ChatGPT clone. It is a **local-first AI gateway for developers** with a knowledge assistant layer on top.

---

## 2. Why This Exists

### The Problem

Students, indie developers, and small teams need LLM capabilities but face three bad options:

| Option | Problem |
|--------|---------|
| Cloud APIs (OpenAI, Anthropic) | Expensive, metered, vendor lock-in |
| Raw Ollama | No API keys, no logging, no sharing, no team controls |
| DIY scripts | Fragile, no UI, no security, no observability |

Companies also want private chatbots over their documents, but existing solutions are either enterprise-expensive or no-code toys that don't give developers API access.

### The Gap

No single tool combines:
- Local-first model serving
- OpenAI-compatible API with proper auth
- A clean dashboard for keys, logs, and models
- Document-based knowledge assistants with citations

ModelDock fills that gap.

### Positioning

**Say:** "OpenAI-compatible API for your local models, with private knowledge assistants"
**Don't say:** "Free ChatGPT," "AI chatbot builder," "train your own AI"

---

## 3. Who It's For

### Primary: Student Developers and Solo Builders

They already use Ollama or local AI. They hate paying per token during prototyping. They want one API key that works across all their side projects. They'll tolerate setup friction if the payoff is real.

### Secondary: Small Teams and Startup Founders

They want private document Q&A for internal use. They want to try AI inside tools without committing to expensive enterprise software. They care about privacy and cost.

### Not For (in v1)

- Non-technical users who need drag-and-drop setup
- Enterprise security teams needing SOC2 compliance
- Users expecting GPT-4 quality from a 7B local model
- Users who need agent orchestration, tool calling, or workflows

---

## 4. Product Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    DESKTOP APP (Tauri)                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React + Vite + TypeScript UI             │  │
│  │  Dashboard | Keys | Models | Assistants | Logs | Docs │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │ IPC                               │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │              FastAPI Local Backend                    │  │
│  │                                                       │  │
│  │  ┌─────────-┐  ┌──────────┐  ┌──────────────────────┐ │  │
│  │  │ Gateway  │  │ Auth &   │  │ Knowledge Pipeline   │ │  │
│  │  │ Router   │  │ API Keys │  │ Upload → Parse →     │ │  │
│  │  │          │  │          │  │ Chunk → Embed →      │ │  │
│  │  │ OpenAI   │  │ Hashed   │  │ Store → Retrieve →   │ │  │
│  │  │ compat   │  │ storage  │  │ Answer + Citations   │ │  │
│  │  └────┬─────┘  └──────────┘  └──────────────────────┘ │  │
│  │       │                                               │  │
│  │  ┌────▼─────────────────────────────────────────────┐ │  │
│  │  │  SQLite (metadata) + sqlite-vec (vectors)        │ │  │
│  │  │  Local filesystem (uploaded files)               │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────┬───────────────────────────────┘  │
│                          │ HTTP                             │
└──────────────────────────┼──────────────────────────────────┘
                           │
                ┌──────────▼──────────┐
                │   Local Ollama      │
                │   (inference only)  │
                └─────────────────────┘

                    ═══════════════

         CLOUD (minimal, for auth + relay only)

    ┌──────────────┐     ┌──────────────────┐
    │ Hosted Auth  │     │  Relay Broker    │
    │ (email login)│     │  (tunnel proxy)  │
    └──────┬───────┘     └────────┬─────────┘
           │                      │
           └───────┬──────────────┘
                   │
         Remote client calls
         https://api.modeldock.dev/v1/*
         → relay forwards to local gateway
         → response streams back
```

### Key Architectural Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Desktop vs. web | Desktop (Tauri) | Native feel, tray icon, auto-start, feels like a real product |
| DB | SQLite | Embedded, zero-config, ships with the app |
| Vector store | sqlite-vec | No separate vector DB to manage |
| Remote access | Outbound relay | No raw port exposure, secure by default |
| Auth | Hosted email login | Required for device identity and relay |
| Workspace model | Single-user per install | Simplest v1; multi-user is Phase 2 |
| Inference | Ollama only | One integration done well > five done poorly |

---

## 5. Technology Stack

| Layer | Technology | Locked? |
|-------|-----------|---------|
| Desktop shell | Tauri | Yes |
| Desktop UI | React + Vite + TypeScript | Yes |
| UI components | Tailwind CSS + shadcn/ui | Yes |
| Local backend | FastAPI (Python) | Yes |
| Local database | SQLite | Yes |
| Local vector store | sqlite-vec | Yes |
| File storage | Local filesystem (app-managed directory) | Yes |
| Inference | Ollama | Yes (v1) |
| Cloud auth | Hosted email auth (Clerk or custom) | Decide during implementation |
| Cloud relay | Custom relay broker | Yes |
| Platform | macOS first | Yes |

### What's NOT in the stack (v1)
- No Redis (SQLite handles everything at v1 scale)
- No Postgres (desktop app, not server)
- No S3 (local filesystem is fine for single-user)
- No Docker (Tauri bundles everything)
- No Windows (future-compat notes only)

---

## 6. Data Model

### Entity Relationship

```
User (hosted)
  └── Device (1:1 in v1)
        └── Workspace (1:1 in v1)
              ├── ApiKey (many)
              ├── ModelConfig (many, synced from Ollama)
              ├── Assistant (many)
              │     └── Document (many)
              │           └── Chunk (many, with vectors)
              ├── RequestLog (many)
              └── RelaySession (1 active)
```

### Entity Details

#### User
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Hosted, from auth provider |
| email | string | Login identity |
| created_at | datetime | Registration timestamp |
| last_login | datetime | Last successful auth |

#### Device
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Unique per installation |
| user_id | UUID | FK to User |
| name | string | User-assigned label (e.g., "MacBook Pro") |
| os | string | "macos" in v1 |
| registered_at | datetime | First registration |
| last_seen | datetime | Last heartbeat |

#### Workspace
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | One per device in v1 |
| device_id | UUID | FK to Device |
| name | string | Default: "My Workspace" |
| created_at | datetime | |

#### ApiKey
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Internal identifier |
| workspace_id | UUID | FK to Workspace |
| label | string | User-assigned name (e.g., "side-project-key") |
| key_hash | string | bcrypt hash of the actual key |
| key_prefix | string | First 8 chars for identification (e.g., "sk-md_a1b2") |
| scope | string | "full" in v1 (future: read-only, specific endpoints) |
| created_at | datetime | |
| last_used_at | datetime | Updated on each valid request |
| revoked | boolean | Soft-delete flag |
| revoked_at | datetime | When revoked |

**Key format:** `sk-md_<32 random alphanumeric chars>`
**Storage rule:** Show the full key exactly once at creation. Store only the hash. Display only the prefix + last 4 chars in the UI (e.g., `sk-md_a1b2...x9z0`).

#### ModelConfig
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| workspace_id | UUID | FK to Workspace |
| ollama_name | string | Model identifier in Ollama (e.g., "llama3.2:3b") |
| display_name | string | Friendly name for UI |
| can_chat | boolean | Supports /v1/chat/completions |
| can_embed | boolean | Supports /v1/embeddings |
| is_default | boolean | Only one per workspace |
| context_length | integer | Max context window |
| synced_at | datetime | Last sync from Ollama |

#### Assistant
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| workspace_id | UUID | FK to Workspace |
| name | string | User-assigned (e.g., "Company FAQ Bot") |
| description | string | Optional short description |
| system_prompt | text | Instructions for the assistant |
| model_id | UUID | FK to ModelConfig (which model to use) |
| embedding_model_id | UUID | FK to ModelConfig (which embedding model) |
| retrieval_top_k | integer | Number of chunks to retrieve (default: 5) |
| similarity_threshold | float | Minimum similarity score (default: 0.7) |
| created_at | datetime | |
| updated_at | datetime | |

#### Document
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| assistant_id | UUID | FK to Assistant |
| original_filename | string | As uploaded |
| file_type | enum | pdf, md, txt, docx |
| file_path | string | Local filesystem path |
| file_size_bytes | integer | |
| checksum | string | SHA-256 of file content |
| status | enum | pending, parsing, chunking, embedding, indexed, failed |
| error_message | text | If status=failed |
| chunk_count | integer | After processing |
| created_at | datetime | Upload time |
| indexed_at | datetime | When indexing completed |

#### Chunk
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| document_id | UUID | FK to Document |
| content | text | The text of this chunk |
| chunk_index | integer | Position in document (0-based) |
| token_count | integer | Estimated tokens |
| embedding | vector | sqlite-vec vector (dimension depends on model) |
| metadata | json | Optional: page number, heading, section |
| created_at | datetime | |

**Chunking strategy (v1):** Fixed-size chunks of ~400 tokens with ~50 token overlap. Simple but reliable. Paragraph-aware splitting where possible.

#### RequestLog
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| workspace_id | UUID | FK to Workspace |
| api_key_id | UUID | FK to ApiKey (nullable if key was invalid) |
| endpoint | string | e.g., "/v1/chat/completions" |
| method | string | GET, POST |
| model_used | string | Ollama model name |
| origin | enum | local, remote |
| status_code | integer | HTTP status |
| latency_ms | integer | Total request time |
| prompt_tokens | integer | Estimated |
| completion_tokens | integer | Estimated |
| total_tokens | integer | Estimated |
| assistant_id | UUID | FK to Assistant (nullable) |
| retrieval_used | boolean | Whether RAG was triggered |
| error_code | string | Application error code if failed |
| error_message | text | Human-readable error |
| created_at | datetime | |

#### RelaySession
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| device_id | UUID | FK to Device |
| status | enum | connected, reconnecting, offline, auth_required |
| tunnel_id | string | Relay broker's session identifier |
| last_heartbeat | datetime | |
| connected_at | datetime | |
| disconnected_at | datetime | |

---

## 7. Phase 1 Feature List

Phase 1 is everything needed for one person to: install the app, connect Ollama, create an API key, use it in their projects, upload documents, and chat with citations. Every feature below is ordered by implementation priority within its group.

---

### Feature 1: Desktop Shell and App Lifecycle

**What:** The Tauri desktop app that wraps the React UI, manages the local FastAPI backend process, and provides system tray integration.

#### 1.1 App Installation and First Launch
- Tauri DMG installer for macOS
- On first launch: create local data directory at `~/Library/Application Support/ModelDock/`
- Create subdirectories: `data/` (SQLite DBs), `files/` (uploaded documents), `logs/`
- Initialize empty SQLite database with full schema
- Show first-run onboarding flow

#### 1.2 Local Backend Process Management
- On app start: spawn FastAPI process on `127.0.0.1:<port>`
- Port selection: use a fixed default (e.g., 52411) with fallback to random available port
- Store active port in a lockfile at `~/Library/Application Support/ModelDock/.port`
- Health check endpoint: `GET /health` returns `{"status": "ok", "version": "0.1.0"}`
- UI polls health endpoint on startup; shows loading state until backend is ready
- If backend crashes: show error banner with "Restart" button; log crash to `logs/`
- On app quit: gracefully shut down FastAPI process

#### 1.3 System Tray
- Menu bar icon (monochrome, macOS-native style)
- Tray menu items:
  - **Open ModelDock** — brings main window to front
  - **Status:** `Connected` / `Ollama Offline` / `Relay Offline`
  - **Separator**
  - **Quit ModelDock** — shuts down backend and exits
- Status dot color: green (all good), yellow (partial — e.g., relay offline but local works), red (backend or Ollama down)
- Optional: launch at login (user-configurable in Settings)

#### 1.4 App Update Mechanism
- v1: manual update (download new DMG from website)
- Show "Update available" banner when new version detected (check GitHub releases or hosted version endpoint)
- Future: Tauri's built-in auto-updater

---

### Feature 2: Onboarding Flow

**What:** A step-by-step first-run wizard that gets the user from zero to first API key in under 10 minutes.

#### 2.1 Step 1 — Welcome Screen
- App logo and tagline: "Your local AI, one API"
- "Get Started" button
- Brief 3-bullet value prop:
  - OpenAI-compatible API for local models
  - API keys and usage logging
  - Private knowledge assistants

#### 2.2 Step 2 — Email Login
- Email + password form (connects to hosted auth)
- "Create Account" and "Sign In" flows
- On success: store auth token securely in macOS Keychain via Tauri
- Error states:
  - Invalid credentials → show error, retry
  - Network unreachable → show "Check your internet connection"
  - Account already exists → show "Sign in instead"
- Why email login: needed for device registration and remote relay

#### 2.3 Step 3 — Ollama Detection
- Auto-detect Ollama at `http://localhost:11434`
- If found: show green checkmark, "Ollama detected" with version
- If not found:
  - Show "Ollama not detected"
  - Link to Ollama download page (https://ollama.com)
  - "I've installed it" retry button
  - Cannot proceed until Ollama responds
- If found but unreachable (port conflict, etc.):
  - Show troubleshooting tips
  - "Retry" button

#### 2.4 Step 4 — Model Selection
- Fetch model list from Ollama API (`GET http://localhost:11434/api/tags`)
- Show available models with:
  - Model name and size
  - Capability badges: "Chat" / "Embeddings" / "Both"
- If no models installed:
  - Show "No models found"
  - Show suggested models to install:
    - Chat: `llama3.2:3b` (small), `llama3.2:latest` (medium)
    - Embeddings: `nomic-embed-text`
  - Show terminal command: `ollama pull llama3.2:3b`
  - "Refresh" button to re-check
  - Cannot proceed until at least one chat model exists
- User selects default chat model and default embedding model
- Store selections in ModelConfig table

#### 2.5 Step 5 — Device Registration
- Auto-register device with hosted service
- Auto-generate device name from hostname (user can edit)
- Show confirmation: "Device registered as [name]"
- Establish relay connection
- Show relay status

#### 2.6 Step 6 — First API Key
- Auto-generate first API key
- Show key in a prominent, copy-friendly box: `sk-md_aBcDeFgH...`
- Warning: "This key will only be shown once. Copy it now."
- "Copy" button with confirmation feedback
- Show quickstart code example:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:52411/v1",
    api_key="sk-md_your_key_here"
)

response = client.chat.completions.create(
    model="llama3.2:3b",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

#### 2.7 Step 7 — Done
- "You're all set!" confirmation
- Quick links: Dashboard, Create Assistant, API Docs
- Redirect to main dashboard

---

### Feature 3: Authentication and Device Management

**What:** Hosted email auth, device registration, and session management that underpins remote access and identity.

#### 3.1 Hosted Auth
- Email + password authentication via hosted service
- JWT access token + refresh token flow
- Access token: short-lived (1 hour)
- Refresh token: long-lived (30 days), stored in macOS Keychain
- Token refresh: automatic, transparent to user
- On refresh failure: show "Session expired" → redirect to login
- Auth provider options (decide during implementation):
  - Option A: Clerk (fastest, handles email/password/magic link)
  - Option B: Custom auth service (more control, more work)

#### 3.2 Device Registration
- On first successful login: register device with hosted service
- Device record: id, user_id, name, os, created_at
- Device name: auto-generated from `hostname`, editable in Settings
- One user can have multiple devices (e.g., desktop + laptop)
- Each device has its own workspace, keys, and data
- Device deregistration: available in Settings (wipes hosted record, local data stays)

#### 3.3 Session Lifecycle
- App startup → check stored refresh token → refresh access token → establish relay
- If no stored token → show login screen
- If refresh fails → show login screen
- Background: refresh access token 5 minutes before expiry
- On logout: revoke refresh token, disconnect relay, clear Keychain entry

---

### Feature 4: Local Gateway (OpenAI-Compatible API)

**What:** The core API that makes ModelDock useful. Any app that works with OpenAI's API can point at ModelDock instead.

#### 4.1 API Key Validation Middleware
- Every `/v1/*` request must include `Authorization: Bearer sk-md_...`
- Validation flow:
  1. Extract key from header
  2. Hash it with bcrypt
  3. Look up matching key_hash in ApiKey table
  4. Check `revoked = false`
  5. Update `last_used_at`
  6. Proceed to endpoint handler
- Invalid/missing key → `401 Unauthorized` with body:
  ```json
  {"error": {"message": "Invalid API key", "type": "authentication_error", "code": "invalid_api_key"}}
  ```
- Revoked key → same 401 response
- All failures logged to RequestLog

#### 4.2 GET /v1/models
- Returns list of available models in OpenAI format
- Source: ModelConfig table (synced from Ollama)
- Response format:
  ```json
  {
    "object": "list",
    "data": [
      {
        "id": "llama3.2:3b",
        "object": "model",
        "created": 1711000000,
        "owned_by": "local-ollama",
        "capabilities": {"chat": true, "embeddings": false}
      }
    ]
  }
  ```
- Model sync: refresh from Ollama on app startup and every 5 minutes
- If Ollama unreachable: return cached list with a warning header

#### 4.3 POST /v1/chat/completions
- The most important endpoint. Must feel identical to OpenAI's API.
- Request body:
  ```json
  {
    "model": "llama3.2:3b",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is Rust?"}
    ],
    "temperature": 0.7,
    "max_tokens": 1024,
    "stream": false
  }
  ```
- Supported parameters (v1):
  | Parameter | Type | Default | Notes |
  |-----------|------|---------|-------|
  | model | string | workspace default | Required if no default set |
  | messages | array | — | Required |
  | temperature | float | 0.7 | 0.0–2.0 |
  | top_p | float | 1.0 | |
  | max_tokens | integer | model-dependent | |
  | stream | boolean | false | SSE streaming |
  | stop | string/array | null | Stop sequences |

- Non-streaming response:
  ```json
  {
    "id": "chatcmpl-<uuid>",
    "object": "chat.completion",
    "created": 1711000000,
    "model": "llama3.2:3b",
    "choices": [{
      "index": 0,
      "message": {"role": "assistant", "content": "Rust is a systems programming language..."},
      "finish_reason": "stop"
    }],
    "usage": {
      "prompt_tokens": 25,
      "completion_tokens": 150,
      "total_tokens": 175
    }
  }
  ```
- Streaming response: Server-Sent Events (SSE), `text/event-stream`
  ```
  data: {"id":"chatcmpl-<uuid>","object":"chat.completion.chunk","choices":[{"delta":{"content":"Rust"},"index":0}]}

  data: {"id":"chatcmpl-<uuid>","object":"chat.completion.chunk","choices":[{"delta":{"content":" is"},"index":0}]}

  data: [DONE]
  ```
- Routing: translate request to Ollama's `/api/chat` format, stream back
- Error cases:
  - Model not found → `404` with model name in error
  - Ollama unreachable → `503 Service Unavailable`
  - Model doesn't support chat → `400` with capability error
  - Request too large → `413` with context length info
- Every request (success or failure) → write RequestLog row

#### 4.4 POST /v1/embeddings
- Request body:
  ```json
  {
    "model": "nomic-embed-text",
    "input": "The quick brown fox"
  }
  ```
  - `input` can be a string or array of strings
- Response:
  ```json
  {
    "object": "list",
    "data": [
      {
        "object": "embedding",
        "index": 0,
        "embedding": [0.0023, -0.0091, ...]
      }
    ],
    "model": "nomic-embed-text",
    "usage": {
      "prompt_tokens": 5,
      "total_tokens": 5
    }
  }
  ```
- Validation: check model has `can_embed = true` before routing
- If model can't embed → `400`:
  ```json
  {"error": {"message": "Model 'llama3.2:3b' does not support embeddings. Use 'nomic-embed-text' instead.", "type": "invalid_request_error", "code": "model_not_supported"}}
  ```
- Used internally by the knowledge pipeline AND externally by API consumers

#### 4.5 Error Response Format
All errors follow OpenAI's format for maximum compatibility:
```json
{
  "error": {
    "message": "Human-readable description",
    "type": "error_type",
    "code": "error_code"
  }
}
```

Error types:
| HTTP | type | code | When |
|------|------|------|------|
| 400 | invalid_request_error | model_not_supported | Wrong capability |
| 400 | invalid_request_error | invalid_request | Bad request body |
| 401 | authentication_error | invalid_api_key | Bad or missing key |
| 404 | not_found_error | model_not_found | Model doesn't exist |
| 413 | invalid_request_error | context_length_exceeded | Too many tokens |
| 429 | rate_limit_error | rate_limit_exceeded | Too many requests |
| 503 | service_unavailable | ollama_unreachable | Ollama is down |

---

### Feature 5: API Key Management

**What:** Create, view, copy, and revoke API keys from the dashboard.

#### 5.1 Create Key
- User clicks "Create API Key" button
- Modal with:
  - **Label** (required): text input, e.g., "my-side-project"
  - **Scope**: "Full Access" (only option in v1, dropdown for future)
- On submit:
  1. Generate key: `sk-md_` + 32 random alphanumeric characters
  2. Hash with bcrypt (cost factor 12)
  3. Store hash, prefix (`sk-md_` + first 4 random chars), and metadata
  4. Return full key to UI
- Show key in a highlighted box with "Copy" button
- Warning banner: "Save this key now. You won't be able to see it again."
- After modal closes, key is never retrievable

#### 5.2 List Keys
- Table columns:
  - Label
  - Key preview: `sk-md_a1b2...x9z0` (prefix + last 4)
  - Created date
  - Last used (relative: "2 hours ago", "Never")
  - Status badge: Active (green) / Revoked (gray)
- Sort: most recently created first
- Empty state: "No API keys yet. Create one to get started."

#### 5.3 Revoke Key
- Click "Revoke" button on any active key
- Confirmation dialog: "Revoke key [label]? Any app using this key will stop working."
- On confirm: set `revoked = true`, `revoked_at = now()`
- Key stays in list with "Revoked" status (for audit trail)
- No "un-revoke" — user must create a new key

#### 5.4 Key Limits
- v1: no hard limit on number of keys (practical limit ~100 per workspace)
- v1: no per-key rate limits (workspace-level only)
- Future: per-key scopes, rate limits, expiration dates

---

### Feature 6: Ollama Connection Management

**What:** Detect, test, and manage the connection to the local Ollama instance.

#### 6.1 Connection Detection
- On app startup and every 60 seconds: ping `http://localhost:11434/api/tags`
- Store connection status: connected, unreachable, error
- If port is different (user changed Ollama config): allow custom URL in Settings

#### 6.2 Model Sync
- On connection established: fetch all models from Ollama
- Parse each model's capabilities:
  - Chat-capable: all models (default)
  - Embedding-capable: models with "embed" in name, or explicitly flagged
- Upsert into ModelConfig table
- Remove models no longer in Ollama (soft-delete: mark as unavailable)
- Sync frequency: on startup + every 5 minutes + manual "Refresh" button

#### 6.3 Models Screen
- Table of all synced models:
  - Model name (e.g., `llama3.2:3b`)
  - Size (e.g., "2.0 GB")
  - Capabilities: Chat / Embeddings badges
  - Default indicator (star icon)
  - Last synced timestamp
- "Set as Default" button per model (for chat and embeddings separately)
- "Refresh Models" button
- Connection status banner at top:
  - Green: "Connected to Ollama"
  - Red: "Ollama unreachable — check that it's running"

#### 6.4 Ollama Settings
- Custom Ollama URL (default: `http://localhost:11434`)
- "Test Connection" button
- Display Ollama version when connected

---

### Feature 7: Request Logging and Observability

**What:** Every API request is logged and visible in the dashboard.

#### 7.1 Request Logging
- Every `/v1/*` request writes a RequestLog row, whether it succeeds or fails
- Captured fields:
  - Timestamp
  - Endpoint and method
  - Model used (or "none" if failed before routing)
  - Origin: `local` or `remote`
  - HTTP status code
  - Latency in milliseconds
  - Token estimates (prompt + completion)
  - Associated assistant ID (if RAG request)
  - Whether retrieval was used
  - Error code and message (if failed)
- Token estimation: use Ollama's reported token counts when available, otherwise estimate from character count / 4

#### 7.2 Logs Screen
- Table view with columns:
  - Timestamp (relative: "2 min ago")
  - Endpoint (`/v1/chat/completions`)
  - Model (`llama3.2:3b`)
  - Origin badge: Local (blue) / Remote (purple)
  - Status badge: 200 (green) / 4xx (yellow) / 5xx (red)
  - Latency (`245ms`)
  - Tokens (`175`)
- Filters (above table):
  - Endpoint dropdown
  - Model dropdown
  - Origin: All / Local / Remote
  - Status: All / Success / Error
  - Date range picker
- Default sort: newest first
- Pagination: 50 per page
- Click any row → detail panel

#### 7.3 Request Detail Panel
- Side panel or modal showing full details:
  - Request ID
  - Timestamp (absolute)
  - Endpoint + method
  - Model used
  - Origin (local/remote)
  - API key used (label + prefix only, not the key)
  - Latency breakdown (if available)
  - Token counts (prompt, completion, total)
  - Status code
  - Error message (if any)
  - Assistant name (if RAG request)
  - Retrieved chunks preview (if RAG request)
  - Citations generated (if any)

#### 7.4 Dashboard Overview Stats
- Top-level cards on the main dashboard:
  - **Total Requests** (today / this week / all time)
  - **Active API Keys** count
  - **Models Available** count
  - **Assistants** count
  - **Avg Latency** (last 24h)
  - **Error Rate** (last 24h)
- Simple request volume chart (last 7 days, bar chart)

---

### Feature 8: Knowledge Assistant — Document Upload and Processing

**What:** Users upload documents that get parsed, chunked, embedded, and stored for retrieval.

#### 8.1 Create Assistant
- "New Assistant" button → creation form:
  - **Name** (required): e.g., "Company FAQ"
  - **Description** (optional): e.g., "Answers questions about our policies"
  - **System Prompt** (optional, has default):
    Default: "You are a helpful assistant. Answer questions based only on the provided context. If the context doesn't contain enough information, say so. Always cite your sources."
  - **Chat Model**: dropdown of chat-capable models
  - **Embedding Model**: dropdown of embedding-capable models
  - **Retrieval Settings** (advanced, collapsible):
    - Top-K chunks: 5 (default)
    - Similarity threshold: 0.7 (default)
- On create: insert Assistant row, redirect to assistant detail page

#### 8.2 Document Upload
- On assistant detail page: "Upload Documents" area
- Drag-and-drop zone + "Browse Files" button
- Supported types: `.pdf`, `.md`, `.txt`, `.docx`
- File size limit: 50 MB per file (v1)
- Max files per assistant: 100 (v1)
- On upload:
  1. Validate file type and size
  2. Copy file to `files/<assistant_id>/<document_id>_<filename>`
  3. Calculate SHA-256 checksum
  4. Insert Document row with status = `pending`
  5. Trigger processing pipeline (async)
- Duplicate detection: if checksum matches existing document in same assistant, warn user
- Upload progress indicator per file
- Batch upload: multiple files at once

#### 8.3 Document Processing Pipeline
This runs asynchronously after upload. Each stage updates the Document status.

**Stage 1: Parsing** (`status: parsing`)
- PDF: extract text using `pymupdf` (fitz) or `pdfplumber`
- Markdown: read as-is
- TXT: read as-is
- DOCX: extract text using `python-docx`
- If parsing fails → `status: failed`, store error message
- Output: raw text content

**Stage 2: Chunking** (`status: chunking`)
- Split text into chunks of ~400 tokens with ~50 token overlap
- Chunking strategy:
  1. Split by paragraphs first (double newline)
  2. If a paragraph exceeds 400 tokens, split by sentences
  3. If a sentence exceeds 400 tokens, split by fixed token count
  4. Add 50-token overlap between consecutive chunks
- Preserve metadata: page number (PDFs), heading context (Markdown)
- Output: list of Chunk objects with content + metadata

**Stage 3: Embedding** (`status: embedding`)
- For each chunk: call Ollama embeddings endpoint with the assistant's embedding model
- Store embedding vector in sqlite-vec
- Rate: process chunks sequentially (v1), batch in future
- If embedding fails for a chunk: retry 3 times, then mark document as `failed`
- Output: all chunks with vectors stored

**Stage 4: Complete** (`status: indexed`)
- Update `indexed_at` timestamp
- Update `chunk_count`
- Document is now available for retrieval

#### 8.4 Document Management UI
- On assistant detail page, "Documents" tab:
  - Table: filename, type, size, status, chunk count, uploaded date
  - Status badges:
    - Pending (gray)
    - Processing (blue, animated)
    - Indexed (green)
    - Failed (red, with error tooltip)
  - Actions per document:
    - **Re-index**: re-run processing pipeline (deletes old chunks first)
    - **Delete**: remove file, chunks, and embeddings
  - Batch actions: delete selected
- Failed documents show error reason and "Retry" button

---

### Feature 9: Knowledge Assistant — Retrieval and Chat

**What:** Ask questions and get answers grounded in uploaded documents, with citations.

#### 9.1 Retrieval Pipeline
When a user sends a message to an assistant:

1. **Embed the query**: use assistant's embedding model to create a vector from the user's question
2. **Search chunks**: query sqlite-vec for top-K most similar chunks within the assistant's documents
3. **Filter by threshold**: discard chunks below similarity_threshold
4. **Build context**: concatenate retrieved chunks into a context block
5. **Construct prompt**:
   ```
   System: {assistant.system_prompt}

   Context from documents:
   ---
   [Source: {document.filename}, Chunk {chunk.chunk_index}]
   {chunk.content}
   ---
   [Source: {document.filename}, Chunk {chunk.chunk_index}]
   {chunk.content}
   ---

   Answer the user's question based on the context above. Cite sources using [Source: filename] format.
   If the context doesn't contain enough information to answer, say "I don't have enough information in the uploaded documents to answer this question."

   User: {user_message}
   ```
6. **Call Ollama**: send constructed prompt to chat model
7. **Return response**: include both the answer text and the source chunks used

#### 9.2 Citation Format
- In-text citations: `[Source: filename.pdf]`
- Response includes a `sources` array:
  ```json
  {
    "answer": "The refund policy allows returns within 30 days [Source: policies.pdf].",
    "sources": [
      {
        "document": "policies.pdf",
        "chunk_index": 3,
        "content": "Customers may return any item within 30 days of purchase...",
        "similarity": 0.89
      }
    ]
  }
  ```
- UI displays sources in a collapsible panel next to the answer

#### 9.3 "I Don't Know" Behavior
- If no chunks pass the similarity threshold → assistant must respond with a variant of: "I don't have enough information in the uploaded documents to answer this question."
- If chunks are retrieved but low confidence (0.5–0.7) → assistant answers but adds disclaimer: "Based on limited information in your documents..."
- The system prompt enforces this behavior; it is NOT optional

#### 9.4 Assistant Chat UI
- Chat interface on assistant detail page:
  - Message input at bottom
  - Chat history (scrollable)
  - Each assistant response shows:
    - Answer text with inline citations
    - "Sources" expandable section below the answer
    - Each source shows: document name, chunk preview, similarity score
  - User messages: right-aligned, blue
  - Assistant messages: left-aligned, gray
  - Streaming: tokens appear as they arrive
- "Clear Chat" button (clears UI only, not logs)
- Each exchange is logged as a RequestLog with `assistant_id` set and `retrieval_used = true`

#### 9.5 Assistant API Access
- Assistants are also accessible via the API (not just the UI):
  ```
  POST /v1/chat/completions
  {
    "model": "llama3.2:3b",
    "messages": [...],
    "assistant_id": "<assistant-uuid>"
  }
  ```
- When `assistant_id` is present: retrieval pipeline runs before sending to model
- Response includes `sources` in a custom extension field (outside the standard OpenAI fields, to stay compatible):
  ```json
  {
    "id": "chatcmpl-...",
    "choices": [...],
    "usage": {...},
    "x_modeldock": {
      "assistant_id": "...",
      "sources": [...]
    }
  }
  ```

---

### Feature 10: Remote Access via Relay

**What:** Call your ModelDock API from any device via a secure hosted relay.

#### 10.1 Relay Architecture
- Desktop app establishes an **outbound** WebSocket connection to the relay broker
- No inbound ports opened on the user's machine
- Relay broker is a hosted service at `relay.modeldock.dev`
- Flow:
  1. Desktop connects to relay via WSS (authenticated with access token)
  2. Relay registers device as "online"
  3. Remote client calls `https://api.modeldock.dev/v1/chat/completions`
  4. Relay authenticates the request (same API key validation)
  5. Relay forwards request through WebSocket to desktop
  6. Desktop's local gateway processes it
  7. Response streams back through relay to remote client

#### 10.2 Relay Connection Lifecycle
- On app startup (after auth): establish WebSocket to relay
- Heartbeat: every 30 seconds
- If connection drops: auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 60s)
- If auth token expired during reconnect: set status to `auth_required`
- UI shows relay status at all times:
  - `Connected` (green): active WebSocket, heartbeat OK
  - `Reconnecting` (yellow): connection lost, attempting to reconnect
  - `Offline` (gray): user is offline or relay unreachable
  - `Auth Required` (red): token expired, needs re-login

#### 10.3 Remote API Endpoint
- Base URL: `https://api.modeldock.dev/v1`
- Supports same endpoints as local:
  - `GET /v1/models`
  - `POST /v1/chat/completions`
  - `POST /v1/embeddings`
- Same API key authentication
- Same request/response format
- Additional behavior:
  - If device offline → `503` with `{"error": {"message": "Device is offline", "code": "device_offline"}}`
  - If relay error → `502 Bad Gateway`
  - Latency: adds relay round-trip (~50-200ms depending on location)
- Request logs show `origin: "remote"` for relay-forwarded requests

#### 10.4 Security Boundaries
- Relay only forwards to authenticated devices
- API key validation happens on the local gateway (relay does not see decrypted responses)
- No device discovery: relay knows device IDs but doesn't expose them
- WebSocket connection is WSS (TLS)
- Remote API is HTTPS-only
- Rate limiting on relay: 100 requests/minute per device (v1)

---

### Feature 11: Dashboard and Main UI

**What:** The primary interface users see after onboarding.

#### 11.1 Navigation
- Left sidebar (collapsible):
  - **Dashboard** (home icon) — overview stats
  - **API Keys** (key icon) — key management
  - **Models** (cube icon) — Ollama models
  - **Assistants** (bot icon) — knowledge assistants
  - **Logs** (list icon) — request history
  - **Playground** (terminal icon) — test API calls
  - **Settings** (gear icon) — app configuration
- Top bar:
  - ModelDock logo (left)
  - Relay status indicator (right)
  - Ollama status indicator (right)
  - User email / avatar (right)

#### 11.2 Dashboard Home
- Welcome message (first time): "Welcome to ModelDock. Here's how to get started."
- Status cards row:
  - Ollama: Connected / Offline
  - Relay: Connected / Offline / Auth Required
  - Models: count available
  - API Keys: count active
- Stats row:
  - Requests today
  - Avg latency (24h)
  - Documents indexed
  - Assistants created
- Quick actions:
  - "Create API Key"
  - "New Assistant"
  - "View Logs"
- Recent activity: last 5 requests (mini table)

#### 11.3 Empty States
Every screen must have a useful empty state:
- **API Keys (empty):** "No API keys yet. Create one to start using ModelDock in your apps." + Create button
- **Models (empty):** "No models found. Make sure Ollama is running and has models installed." + Refresh button + install guide link
- **Assistants (empty):** "No assistants yet. Create one to chat with your documents." + Create button
- **Logs (empty):** "No requests yet. Use an API key to make your first call." + quickstart code block
- **Documents (empty, on assistant page):** "No documents uploaded. Add files to give this assistant knowledge." + Upload button

#### 11.4 Settings Screen
- **Account**
  - Email (read-only)
  - Logout button
- **Device**
  - Device name (editable)
  - Device ID (read-only, for support)
  - Deregister device button (with confirmation)
- **Ollama**
  - Ollama URL (editable, default: http://localhost:11434)
  - Test Connection button
  - Connection status
- **Relay**
  - Relay status display
  - "Disconnect Relay" toggle (for users who want local-only)
- **App**
  - Launch at login toggle
  - Data directory path (read-only)
  - Export data (future)
  - Reset app (danger zone, with confirmation)
- **About**
  - App version
  - Ollama version
  - License info
  - Link to docs / GitHub

---

### Feature 12: Playground

**What:** A built-in API testing interface. Lower priority than core features but high value for developer experience.

#### 12.1 Chat Playground
- Model selector dropdown
- System prompt input (optional)
- Message input
- Send button
- Response area with streaming
- Shows token count after response
- Shows latency
- "Clear" button to reset conversation

#### 12.2 Assistant Playground
- Assistant selector dropdown
- Message input
- Response area with citations panel
- Same streaming and metrics as chat playground
- Useful for testing retrieval quality before deploying

#### 12.3 API Request Preview
- "Show as cURL" button: generates a copy-ready cURL command for the current playground request
- "Show as Python" button: generates OpenAI SDK code
- Helps developers integrate quickly

---

## 8. Phase 1 Build Order

This is the exact sequence to implement features. Each step produces something testable.

| # | What to Build | Depends On | Testable Outcome |
|---|--------------|-----------|------------------|
| 1 | **Project scaffolding** | Nothing | Tauri app opens, shows blank React page |
| 2 | **SQLite schema + migrations** | #1 | All tables created, can insert/query from Python |
| 3 | **FastAPI backend skeleton** | #1 | Health endpoint returns OK, Tauri can call it |
| 4 | **UI shell + navigation** | #1 | Sidebar, routing, empty screens render |
| 5 | **Ollama connection manager** | #3 | Backend detects Ollama, fetches models |
| 6 | **Auth integration** | #3 | Email login works, token stored in Keychain |
| 7 | **Onboarding flow** | #4, #5, #6 | New user completes setup end-to-end |
| 8 | **API key CRUD** | #2, #3 | Create, list, revoke keys via UI |
| 9 | **API key validation middleware** | #8 | Invalid key returns 401 |
| 10 | **GET /v1/models** | #5, #9 | Returns model list with valid key |
| 11 | **POST /v1/chat/completions** | #5, #9 | Chat works, streaming works, OpenAI SDK compatible |
| 12 | **POST /v1/embeddings** | #5, #9 | Embeddings return vectors |
| 13 | **Request logging** | #2, #11 | Every request creates a log row |
| 14 | **Logs screen** | #4, #13 | View, filter, and inspect request logs |
| 15 | **Dashboard home** | #4, #13 | Stats cards and recent activity show real data |
| 16 | **Models screen** | #4, #5 | View models, set default, refresh |
| 17 | **API keys screen** | #4, #8 | Full key management UI |
| 18 | **Document upload + parsing** | #2, #3 | Upload PDF/MD/TXT/DOCX, text extracted |
| 19 | **Chunking + embedding** | #12, #18 | Documents chunked, vectors stored in sqlite-vec |
| 20 | **Retrieval pipeline** | #19 | Query returns relevant chunks |
| 21 | **Assistant creation UI** | #4 | Create assistant with settings |
| 22 | **Assistant chat with citations** | #11, #20, #21 | Ask questions, get answers with sources |
| 23 | **Device registration** | #6 | Device registered with hosted service |
| 24 | **Relay connection** | #6, #23 | WebSocket established, heartbeat working |
| 25 | **Remote API forwarding** | #11, #24 | Remote client can call API through relay |
| 26 | **Relay status UI** | #4, #24 | Status indicator shows connection state |
| 27 | **Settings screen** | #4 | All settings functional |
| 28 | **Playground** | #4, #11 | Test chat and assistants interactively |
| 29 | **System tray** | #1 | Menu bar icon with status and quick actions |
| 30 | **Onboarding polish** | #7 | Smooth, handles all error states |

### Milestone Checkpoints

**Milestone A (Steps 1–4): "App Runs"**
- Tauri opens, React renders, FastAPI responds, SQLite ready
- Estimated: ~1 week

**Milestone B (Steps 5–12): "API Works"**
- Ollama connected, keys work, all three endpoints functional
- You can use `curl` or OpenAI SDK to talk to local models
- Estimated: ~2 weeks

**Milestone C (Steps 13–17): "Dashboard Works"**
- Logs, stats, models, and keys visible in the UI
- Product feels real, not just a backend
- Estimated: ~1 week

**Milestone D (Steps 18–22): "Knowledge Works"**
- Upload docs, get answers with citations
- The differentiating feature is complete
- Estimated: ~2 weeks

**Milestone E (Steps 23–26): "Remote Works"**
- Call your API from anywhere via relay
- Estimated: ~2 weeks

**Milestone F (Steps 27–30): "Polish"**
- Settings, playground, tray, onboarding refinement
- Estimated: ~1 week

---

## 9. Phase 2 and Beyond

### Phase 2: Team Beta
- Workspaces with multiple members
- Assistant and document sharing
- Role-based access (owner, editor, viewer)
- Background job queue for large document batches
- Document re-sync workflow
- Improved chunking strategies
- Answer quality evaluation tools

### Phase 3: Paid Readiness
- Pricing tiers (Free / Pro / Team)
- Usage caps and quota enforcement
- Hybrid local + cloud model routing
- Admin controls and audit dashboard
- Advanced observability

### Phase 4+: Platform
- Multiple model providers (OpenAI, Anthropic, etc.)
- Agent workflows and tool calling
- Fine-tuning orchestration
- SDK and webhooks
- Connectors (Slack, Notion, Google Docs)
- Prompt version management

---

## 10. Security Baseline

### Must Do (v1)

| Area | Requirement |
|------|-------------|
| API keys | bcrypt hashed, shown once at creation, prefix-only in UI |
| Auth tokens | Stored in macOS Keychain, not in plaintext files |
| Relay | WSS only, authenticated sessions, no device discovery |
| Remote API | HTTPS only |
| Documents | Workspace-scoped, no cross-workspace access |
| File uploads | Type validation, 50 MB limit, no executable files |
| Ollama | Never exposed to public internet |
| Rate limiting | 100 req/min remote, 1000 req/min local (v1 defaults) |
| Prompt injection | System prompt instructs model to stay grounded in sources |
| Audit | All key operations logged (create, revoke, login, device register) |
| Secrets | No secrets in logs, no API keys in request logs |

### Must NOT Do
- Store API keys in plaintext anywhere
- Log full request/response bodies (privacy)
- Expose Ollama port to public internet
- Mix documents between workspaces
- Allow silent indexing failures
- Skip auth on any `/v1/*` endpoint

---

## 11. Success Metrics

### User Experience (MVP)
| Metric | Target |
|--------|--------|
| Time to first API call | < 10 minutes from install |
| Time to first knowledge answer | < 15 minutes from install |
| Citation rate | 80%+ of RAG answers include citations |
| Chat latency (p95, local) | < 5 seconds (model-dependent) |

### Product Health
| Metric | Target |
|--------|--------|
| Document indexing success rate | > 95% |
| Local service uptime | > 99.9% |
| Relay connection uptime | > 99.5% |
| API compatibility | Pass OpenAI SDK basic test suite |

### Engagement (post-launch)
| Metric | Target |
|--------|--------|
| Weekly active API key usage | Track |
| Assistants created per user | Track |
| Documents uploaded per assistant | Track |
| Remote vs local request ratio | Track |
| 30-day retention | Track |

---

## 12. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Local models too slow for good UX | High | Medium | Recommend specific models, show expected latency during setup |
| Retrieval quality disappoints users | High | Medium | Default to "I don't know", show source chunks, tune similarity threshold |
| Relay adds too much latency | Medium | Low | Measure and display relay latency, allow local-only mode |
| Ollama API changes break integration | Medium | Low | Pin to known Ollama versions, add version detection |
| Setup friction causes abandonment | High | Medium | Invest in onboarding wizard, test with real users at milestone B |
| Document parsing fails on real PDFs | Medium | High | Test with diverse real-world PDFs, graceful failure states |
| Scope creep delays launch | High | High | This PRD is the scope. Nothing else ships in Phase 1. |

---

## 13. Non-Goals

These are explicitly out of scope for Phase 1. Do not build them.

- Fine-tuning pipeline
- Multi-provider model routing (OpenAI, Anthropic, etc.)
- Agent workflows or tool calling
- Voice or audio features
- Mobile apps
- Windows support
- Slack, Discord, or WhatsApp integrations
- Billing or payment processing
- Advanced team permissions
- Custom workflow builders
- Browser automation
- Plugin or extension system
- Vector DB abstraction (sqlite-vec only)
- Auto-evaluation research
- Prompt template marketplace
- Multi-language UI

---

## Appendix A: Key Format Specification

```
Format:  sk-md_<32 alphanumeric characters>
Example: sk-md_aB3dEf7gHi9jKlMnOpQrStUvWx1y2z3A
Prefix:  sk-md_
Length:  38 characters total
Charset: a-z, A-Z, 0-9
Storage: bcrypt hash (cost 12)
Display: sk-md_aB3d...2z3A (prefix + first 4 + ... + last 4)
```

## Appendix B: Supported File Types (v1)

| Type | Extension | Parser | Notes |
|------|-----------|--------|-------|
| PDF | .pdf | pymupdf or pdfplumber | Text extraction only, no OCR in v1 |
| Markdown | .md | Raw text | Preserves headers for chunk metadata |
| Plain text | .txt | Raw text | Simplest case |
| Word | .docx | python-docx | Text + basic structure |

## Appendix C: Recommended Ollama Models (v1)

| Use Case | Model | Size | Notes |
|----------|-------|------|-------|
| Chat (small) | llama3.2:3b | ~2 GB | Fast, good for testing |
| Chat (medium) | llama3.2:latest | ~4.7 GB | Better quality |
| Chat (large) | llama3.1:8b | ~4.7 GB | Best local quality |
| Embeddings | nomic-embed-text | ~274 MB | Best local embedding model |

## Appendix D: Local Directory Structure

```
~/Library/Application Support/ModelDock/
├── data/
│   ├── modeldock.db          # SQLite main database
│   └── modeldock.db-vec      # sqlite-vec index
├── files/
│   └── <assistant-id>/
│       └── <doc-id>_<filename>
├── logs/
│   ├── backend.log
│   └── crash.log
└── .port                     # Current backend port
```
