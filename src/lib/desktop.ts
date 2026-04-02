import { invoke } from "@tauri-apps/api/core";

export type DesktopBackendState = {
  baseUrl: string;
  port: number;
  dataDir: string;
  running: boolean;
};

const fallbackState: DesktopBackendState = {
  baseUrl: "http://127.0.0.1:52411",
  port: 52411,
  dataDir: "",
  running: false,
};

function isTauriDesktop() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getBackendState(): Promise<DesktopBackendState> {
  if (!isTauriDesktop()) {
    return fallbackState;
  }

  try {
    return await invoke<DesktopBackendState>("get_backend_state");
  } catch (error) {
    throw error instanceof Error ? error : new Error("Failed to read backend state");
  }
}

export async function restartBackend(): Promise<DesktopBackendState> {
  if (!isTauriDesktop()) {
    return fallbackState;
  }

  try {
    return await invoke<DesktopBackendState>("restart_backend");
  } catch (error) {
    throw error instanceof Error ? error : new Error("Failed to restart backend");
  }
}
