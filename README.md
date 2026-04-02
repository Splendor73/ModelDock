# ModelDock

ModelDock is a local-first desktop AI gateway and control plane built around Ollama. It wraps a Tauri desktop shell, a React frontend, and a FastAPI backend into a single developer-facing app that exposes an OpenAI-compatible API over local models while also giving you a UI for model inventory, API keys, assistants, logs, playground requests, runtime controls, and local settings. The current repo is actively developed and usable for local experimentation, but it is not yet production-ready and some runtime-management behavior is still under active debugging.

## Screenshots

Screenshots are not yet curated in the repository. The current desktop UI includes:

- Dashboard
- API Keys
- Models
- Runtime
- Assistants
- Logs
- Playground
- Settings

If you are evaluating the app visually, run the desktop shell locally with `npm run tauri dev`.

## Core Capabilities

- Run a local desktop control plane for Ollama-backed models.
- Expose an OpenAI-compatible surface over local inference endpoints.
- Manage local API keys for client applications.
- Sync local Ollama model tags into the app and choose defaults.
- Create document-grounded assistants and attach uploaded source files.
- Inspect request logs and recent activity from the local gateway.
- Send local chat requests from a built-in playground.
- Update local runtime and Ollama settings from the desktop UI.
- Restart the managed backend from the desktop shell.

## Architecture Overview

ModelDock is split into three main layers:

1. Desktop shell
   - Tauri owns the local desktop window and process lifecycle.
   - On startup it launches the FastAPI backend from the local Python virtualenv.
   - It resolves a backend port, writes that port to a local `.port` file, and exposes backend state to the React app through Tauri commands.

2. Frontend
   - A React + Vite desktop UI lives in `src/`.
   - The UI is hash-routed and talks to the FastAPI backend using the base URL returned by Tauri.
   - It contains the full desktop control surface for keys, models, assistants, logs, playground requests, runtime, and settings.

3. Backend
   - A FastAPI service in `backend/app/` provides both control-plane routes under `/api/*` and OpenAI-compatible routes under `/v1/*`.
   - It persists local state in SQLite and stores uploaded files and logs inside the local app-data directory.
   - It proxies model operations to a locally running Ollama instance.

## Tech Stack

- Desktop shell: Tauri, Rust
- Frontend: React 19, TypeScript, Vite
- Backend: FastAPI, Uvicorn, Pydantic Settings
- Persistence: SQLite via `aiosqlite`
- Local model runtime: Ollama
- Document parsing: PyMuPDF, python-docx
- Auth/security primitives: bcrypt-based key hashing

## Repository Structure

```text
ModelDock/
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI route modules
│   │   ├── core/             # settings, database, app paths
│   │   ├── models/           # backend data model layer
│   │   └── services/         # Ollama, keys, logs, workspace logic
│   └── requirements.txt
├── specs/                    # product/design notes and briefs
├── src/                      # React desktop frontend
│   ├── components/
│   ├── context/
│   ├── lib/
│   └── pages/
├── src-tauri/
│   └── src/                  # Tauri backend manager and commands
├── BUGS.md                   # active bug tracker
├── package.json
└── vite.config.ts
```

## How It Works End-to-End

1. You launch the desktop app with Tauri.
2. Tauri starts the FastAPI backend from `backend/venv/bin/python`.
3. The backend binds to `127.0.0.1`, preferring port `52411` and falling back to a free local port if needed.
4. Tauri writes the active port to the local app-data `.port` file and returns the backend base URL to the frontend.
5. The React app uses that resolved base URL for all API calls.
6. FastAPI serves:
   - health and control-plane routes under `/api/*`
   - OpenAI-compatible routes under `/v1/*`
7. Ollama handles local model execution.
8. SQLite and local app files store keys, assistants, documents, logs, settings, and other local state.

## Local Development Setup

### Prerequisites

- Node.js 20+ recommended
- npm
- Rust toolchain for Tauri
- Tauri system prerequisites for your OS
- Python 3.11+ recommended
- Ollama installed locally and available at `http://localhost:11434`

### Frontend Dependencies

Install Node dependencies from the repo root:

```bash
npm install
```

### Backend Virtualenv

This repo expects the backend Python environment at:

```text
backend/venv
```

Create it and install backend requirements:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Ollama

ModelDock assumes Ollama is installed and running locally. Verify that it is reachable:

```bash
curl http://localhost:11434/api/tags
```

If that does not return successfully, the app will not be able to sync or run local models.

## Running the App

The primary local development flow is:

```bash
npm run tauri dev
```

This does all of the following:

- runs the Vite frontend dev server
- starts the Tauri desktop app
- launches the FastAPI backend from the local Python virtualenv

You can also build the frontend bundle directly:

```bash
npm run build
```

## Backend / API Overview

The FastAPI app entrypoint is:

```text
backend/app/main.py
```

### Core Surfaces

- `/health`
  - backend health and local status surface
- `/api/keys`
  - key creation, listing, revocation
- `/api/models`
  - model sync/default selection behavior
- `/api/assistants`
  - assistant management
- `/api/documents`
  - document upload and removal
- `/api/logs`
  - request log inspection
- `/api/runtime`
  - runtime and keep-alive controls
- `/api/settings`
  - local settings such as Ollama base URL

### OpenAI-Compatible Surface

- `/v1/models`
- `/v1/chat/completions`
- `/v1/embeddings`

These routes let local clients talk to ModelDock as if they were speaking to an OpenAI-style API, while ModelDock handles local routing and policy.

## Desktop Runtime Behavior

The Tauri backend manager lives in:

```text
src-tauri/src/lib.rs
```

Current desktop runtime behavior:

- starts FastAPI on app launch
- prefers backend port `52411`
- falls back to another available localhost port if needed
- exposes `get_backend_state` and `restart_backend` to the UI
- writes the active backend port to the local `.port` file
- writes backend logs to the app-data logs directory
- stops the managed backend process on app exit

This means the React app does not hard-code a backend port and instead resolves it dynamically through Tauri.

## Current UI Surface / Pages

The implemented pages live in `src/pages/` and currently include:

- `Dashboard`
  - system overview, request activity, quick actions, key/model/assistant/document summaries
- `API Keys`
  - local credential issuance, status tracking, and OpenAI-compatible gateway endpoint details
- `Models`
  - synced Ollama inventory, default model selection, and model detail views
- `Runtime`
  - keep-alive and loaded-runner controls for Ollama-backed models
- `Assistants`
  - assistant creation and document-grounded workspace management
- `Logs`
  - local gateway request history and request inspection
- `Playground`
  - built-in local chat testing surface against `/v1/chat/completions`
- `Settings`
  - backend status, local paths, Ollama endpoint configuration, and restart controls

## Data Storage and Local Files

ModelDock stores local data in the platform app-data directory under `ModelDock`.

Examples:

- macOS: `~/Library/Application Support/ModelDock`
- Windows: `%APPDATA%/ModelDock`
- Linux: `~/.local/share/ModelDock` or `$XDG_DATA_HOME/ModelDock`

Important local files and folders include:

- SQLite database:
  - `data/modeldock.db`
- persisted local settings:
  - `data/settings.json`
- uploaded documents:
  - `files/`
- backend logs:
  - `logs/backend.log`
- active backend port:
  - `.port`

## Known Issues and Current Limitations

ModelDock is actively usable, but it is still an in-progress local developer tool.

Current repo-truth limitations:

- Runtime / resident mode is still under active debugging.
- The `Runtime` page has known instability tracked in [`BUGS.md`](/Users/yashupatel/Documents/YGP_Project/ModelDock/BUGS.md).
- There is no formal automated frontend test suite configured yet.
- The runtime-control integration against Ollama is still being hardened across version differences.
- The project is not yet production-ready.

If you are trying to understand active defects before contributing, read:

- [`BUGS.md`](./BUGS.md)

## Roadmap / Next Steps

Near-term areas that still need work:

- stabilize the `Runtime` page and resident-mode controls
- improve end-to-end runtime visibility for loaded models
- harden the playground and runtime flows against local error cases
- expand automated test coverage, especially for frontend state and route behavior
- continue polishing the desktop UI and layout consistency
- improve contributor ergonomics and documentation

## Contributing / Developer Notes

This repo is currently best approached as an active local development project rather than a finished product.

A few practical notes for contributors:

- Keep the README and `BUGS.md` aligned with actual repo behavior.
- Prefer documenting implemented behavior rather than aspirational behavior.
- The app depends on a local Ollama installation for model sync and inference.
- The backend expects the Python virtualenv at `backend/venv`.
- The Tauri shell is responsible for starting and managing the FastAPI backend in local development.
- When debugging runtime issues, verify both:
  - the backend `/api/runtime` responses
  - the live frontend route behavior in the Tauri webview

Useful files when orienting:

- [`backend/app/main.py`](./backend/app/main.py)
- [`backend/requirements.txt`](./backend/requirements.txt)
- [`src-tauri/src/lib.rs`](./src-tauri/src/lib.rs)
- [`src/pages/Dashboard.tsx`](./src/pages/Dashboard.tsx)
- [`src/pages/ApiKeys.tsx`](./src/pages/ApiKeys.tsx)
- [`src/pages/Models.tsx`](./src/pages/Models.tsx)
- [`src/pages/Runtime.tsx`](./src/pages/Runtime.tsx)
- [`src/pages/Assistants.tsx`](./src/pages/Assistants.tsx)
- [`src/pages/Logs.tsx`](./src/pages/Logs.tsx)
- [`src/pages/Playground.tsx`](./src/pages/Playground.tsx)
- [`src/pages/Settings.tsx`](./src/pages/Settings.tsx)

If you are booting the project for the first time, the fastest path is:

1. Install Ollama and verify it is running.
2. Install Node dependencies from the repo root.
3. Create `backend/venv` and install `backend/requirements.txt`.
4. Start the desktop app with `npm run tauri dev`.
