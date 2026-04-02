import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { Panel } from "@/components/ui/primitives";
import { AppProvider, useDesktop } from "@/context/AppContext";
import ApiKeys from "@/pages/ApiKeys";
import Assistants from "@/pages/Assistants";
import Dashboard from "@/pages/Dashboard";
import Logs from "@/pages/Logs";
import Models from "@/pages/Models";
import Playground from "@/pages/Playground";
import Runtime from "@/pages/Runtime";
import Settings from "@/pages/Settings";

function AppBoot() {
  const { backendLoading, backendError } = useDesktop();

  if (backendLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Panel variant="hero" className="w-full max-w-md p-8">
          <p className="font-label text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            ModelDock
          </p>
          <h1 className="font-headline mt-3 text-3xl font-black tracking-[-0.05em] text-foreground">
            Starting local services
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The desktop shell is waiting for the local FastAPI backend to come online.
          </p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]">
            <div className="h-full w-2/5 animate-pulse rounded-full bg-primary" />
          </div>
        </Panel>
      </div>
    );
  }

  if (backendError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Panel variant="hero" className="w-full max-w-xl border-destructive/40 p-8">
          <p className="font-label text-[10px] uppercase tracking-[0.3em] text-destructive">
            Startup Failed
          </p>
          <h1 className="font-headline mt-3 text-3xl font-black tracking-[-0.05em] text-foreground">
            ModelDock could not start the local backend
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{backendError}</p>
        </Panel>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/keys" element={<ApiKeys />} />
          <Route path="/models" element={<Models />} />
          <Route
            path="/runtime"
            element={
              <RouteErrorBoundary title="Runtime page crashed">
                <Runtime />
              </RouteErrorBoundary>
            }
          />
          <Route path="/assistants" element={<Assistants />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppBoot />
    </AppProvider>
  );
}
