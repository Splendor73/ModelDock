import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, type HealthResponse, setApiBase } from "@/lib/api";
import {
  getBackendState,
  restartBackend as restartBackendCommand,
  type DesktopBackendState,
} from "@/lib/desktop";

type AppContextValue = {
  backend: DesktopBackendState | null;
  backendLoading: boolean;
  backendError: string | null;
  health: HealthResponse | null;
  healthLoading: boolean;
  refreshBackendState: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  restartBackend: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

async function waitForHealth(maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await api.health();
      return;
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
  }
}

export function AppProvider({ children }: PropsWithChildren) {
  const [backend, setBackend] = useState<DesktopBackendState | null>(null);
  const [backendLoading, setBackendLoading] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  async function refreshBackendState() {
    setBackendLoading(true);
    try {
      const nextState = await getBackendState();
      setApiBase(nextState.baseUrl);
      setBackend(nextState);
      setBackendError(null);
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : "Failed to resolve backend state");
    } finally {
      setBackendLoading(false);
    }
  }

  async function refreshHealth() {
    if (!backend) {
      setHealth(null);
      setHealthLoading(false);
      return;
    }

    setHealthLoading(true);
    try {
      const nextHealth = await api.health();
      setHealth(nextHealth);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }

  async function restartBackend() {
    const nextState = await restartBackendCommand();
    setApiBase(nextState.baseUrl);
    setBackend(nextState);
    await waitForHealth();
    await refreshHealth();
  }

  useEffect(() => {
    void refreshBackendState();
  }, []);

  useEffect(() => {
    if (!backend) {
      return;
    }

    void refreshHealth();
    const interval = window.setInterval(() => {
      void refreshHealth();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [backend]);

  const value = useMemo<AppContextValue>(
    () => ({
      backend,
      backendLoading,
      backendError,
      health,
      healthLoading,
      refreshBackendState,
      refreshHealth,
      restartBackend,
    }),
    [backend, backendError, backendLoading, health, healthLoading]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useDesktop() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useDesktop must be used within AppProvider");
  }
  return context;
}
