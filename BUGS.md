# Bug Tracker

## Active Bugs

### BUG-001: Runtime page can crash the client UI on interaction
- **Severity:** High
- **Location:** `/Users/yashupatel/Documents/YGP_Project/ModelDock/src/pages/Runtime.tsx`
- **Description:** Interacting with the Runtime page can blank the app view, indicating an uncaught client-side exception in the runtime route or one of its interaction/render paths.
- **Steps to Reproduce:**
  1. Launch the desktop app and navigate to `Runtime`.
  2. Interact with runtime controls such as the toggle, model select, apply, load, or unload actions.
  3. Observe the runtime page or app view blanking.
- **Expected Behavior:** The page should remain mounted and either apply the action or show an inline error.
- **Actual Behavior:** The route can crash and blank the app view.
- **Root Cause:** Backend runtime calls now succeed for tested payloads, so the remaining issue is likely a client-side exception in the runtime route interaction/render path. The exact browser-side error still needs to be surfaced from the live Tauri webview.
- **Suggested Fix:** Keep a route-level error boundary in place to prevent full blank screens, simplify the runtime route state flow, and capture the exact client error message from the boundary/devtools for the final underlying fix.
- **Status:** In Progress

### BUG-002: Resident mode used an invalid Ollama keep_alive payload
- **Severity:** High
- **Location:** `/Users/yashupatel/Documents/YGP_Project/ModelDock/backend/app/services/ollama.py`
- **Description:** Resident mode is still failing from the app flow. Ollama 0.19.0 rejects `keep_alive` when it is sent as the string `"-1"`, and the integrated runtime flow still needs end-to-end verification in the live app.
- **Steps to Reproduce:**
  1. Enable resident mode for a model.
  2. Apply runtime mode.
  3. Observe the action fail instead of pinning the model in memory.
- **Expected Behavior:** Resident mode should load the model successfully.
- **Actual Behavior:** The resident action still throws an error from the app path instead of keeping the model loaded.
- **Root Cause:** Ollama expects numeric `-1` for resident keep-alive, not string `"-1"`. The backend normalization was added, but the live app/runtime path still needs verification after restart and may still have a frontend/runtime integration issue.
- **Suggested Fix:** Keep normalizing resident keep-alive to numeric `-1`, then verify the running app is using the updated backend and that no frontend runtime-state bug is masking a successful resident apply.
- **Status:** In Progress

## Resolved Bugs
