import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  api,
  type ModelSummary,
  type RuntimeModelInfo,
  type RuntimeStateResponse,
} from "@/lib/api";
import {
  ActionButton,
  DataBadge,
  EmptyState,
  PageHeader,
  Panel,
  surfaceClasses,
} from "@/components/ui/primitives";

const DURATION_OPTIONS = [
  { value: "-1", label: "Resident" },
  { value: "30m", label: "30 minutes" },
  { value: "5m", label: "5 minutes" },
];

type DraftState = {
  enabled: boolean;
  model: string;
  duration: string;
};

export default function Runtime() {
  const [runtime, setRuntime] = useState<RuntimeStateResponse | null>(null);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [draft, setDraft] = useState<DraftState>({
    enabled: false,
    model: "",
    duration: "5m",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<"apply" | "load" | "unload" | "refresh" | "">("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const runningModels = runtime?.running_models ?? [];
  const managedModel = runtime?.keep_alive_model ?? "";
  const managedEnabled = runtime?.keep_alive_enabled ?? false;

  const selectableModels = useMemo(
    () => models.filter((model) => Boolean(model.can_chat)),
    [models]
  );

  useEffect(() => {
    void refreshPage(true);
  }, []);

  async function refreshPage(initial = false) {
    if (!initial) {
      setBusyAction("refresh");
      setRefreshing(true);
    }

    try {
      const [runtimeResponse, modelsResponse] = await Promise.all([
        api.getRuntimeState(),
        api.listModels(),
      ]);

      setRuntime(runtimeResponse);
      setModels(modelsResponse.models);
      setDraft((current) => hydrateDraft(runtimeResponse, modelsResponse.models, current.model));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load runtime state.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setBusyAction("");
    }
  }

  async function handleApply() {
    if (draft.enabled && !draft.model) {
      setErrorMessage("Select a model before enabling resident mode.");
      setStatusMessage("");
      return;
    }

    setBusyAction("apply");
    setErrorMessage("");
    setStatusMessage("");

    try {
      await api.updateRuntimeState({
        keep_alive_enabled: draft.enabled,
        keep_alive_model: draft.enabled ? draft.model || null : null,
        keep_alive_duration: draft.duration,
      });

      await refreshPage();
      setStatusMessage(
        draft.enabled
          ? `${draft.model} is now managed with ${draft.duration === "-1" ? "resident" : draft.duration} keep-alive.`
          : "Resident mode disabled."
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not apply runtime mode.");
      setStatusMessage("");
      setDraft((current) => hydrateDraft(runtime, models, current.model));
      setBusyAction("");
    }
  }

  async function handleLoad() {
    if (!draft.model) {
      setErrorMessage("Select a model before loading it.");
      setStatusMessage("");
      return;
    }

    setBusyAction("load");
    setErrorMessage("");
    setStatusMessage("");

    try {
      await api.loadRuntimeModel(draft.model, draft.duration);
      await refreshPage();
      setStatusMessage(`${draft.model} was asked to load into memory.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load the selected model.");
      setStatusMessage("");
      setBusyAction("");
    }
  }

  async function handleUnload(targetModel?: string) {
    const modelToUnload = targetModel || draft.model;
    if (!modelToUnload) {
      setErrorMessage("Select a model before unloading it.");
      setStatusMessage("");
      return;
    }

    setBusyAction("unload");
    setErrorMessage("");
    setStatusMessage("");

    try {
      if (managedEnabled && managedModel === modelToUnload) {
        await api.updateRuntimeState({
          keep_alive_enabled: false,
          keep_alive_model: null,
          keep_alive_duration: runtime?.keep_alive_duration || draft.duration,
        });
        await refreshPage();
        setStatusMessage(`${modelToUnload} was unloaded and resident mode was disabled.`);
      } else {
        await api.unloadRuntimeModel(modelToUnload);
        await refreshPage();
        setStatusMessage(`${modelToUnload} was asked to unload from memory.`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not unload the selected model.");
      setStatusMessage("");
      setBusyAction("");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-8">
      <PageHeader
        eyebrow="Runtime Manager"
        title="Runtime"
        description="Keep one local Ollama model warm, manually load or unload runners, and inspect what is currently active in memory."
        actions={
          <ActionButton
            variant="secondary"
            icon={RefreshCw}
            onClick={() => void refreshPage()}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh Runtime"}
          </ActionButton>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Resident Mode"
          value={managedEnabled ? "Enabled" : "Off"}
          detail={managedEnabled ? "One model is persisted" : "Nothing pinned"}
        />
        <SummaryCard
          label="Managed Model"
          value={managedModel || "None"}
          detail="Saved keep-alive target"
        />
        <SummaryCard
          label="Loaded Runners"
          value={String(runningModels.length)}
          detail={runningModels.length === 1 ? "1 model in memory" : `${runningModels.length} models in memory`}
        />
        <SummaryCard
          label="Ollama"
          value={runtime?.ollama_version || "Unknown"}
          detail={runtime?.runtime_strategy ? runtime.runtime_strategy : "auto detect"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
        <Panel className="p-6">
          <div className="border-b border-[var(--border-soft)] pb-5">
            <h2 className="font-headline text-[1.6rem] font-bold tracking-[-0.04em] text-foreground">
              Runtime Controls
            </h2>
            <p className="mt-2 max-w-[56ch] text-sm leading-6 text-muted-foreground">
              Apply a persisted keep-alive mode, or manually load and unload a model without
              changing the saved runtime config.
            </p>
          </div>

          <div className="mt-5 space-y-5">
            <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-muted)] px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-headline text-xl font-bold tracking-[-0.03em] text-foreground">
                    Keep selected model warm
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Enabled requests reuse the configured keep-alive window for the selected model.
                  </p>
                </div>

                <button
                  type="button"
                  aria-pressed={draft.enabled}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      enabled: !current.enabled,
                    }))
                  }
                  className={`relative h-8 w-14 rounded-full transition-colors ${
                    draft.enabled ? "bg-primary" : "bg-[var(--surface-shell)]"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${
                      draft.enabled ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Model
                </span>
                <select
                  value={draft.model}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      model: event.currentTarget.value,
                    }))
                  }
                  className={surfaceClasses.select}
                >
                  <option value="">Select a chat model</option>
                  {selectableModels.map((model) => (
                    <option key={model.id} value={model.ollama_name}>
                      {model.ollama_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Keep-Alive Window
                </span>
                <select
                  value={draft.duration}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      duration: event.currentTarget.value,
                    }))
                  }
                  className={surfaceClasses.select}
                >
                  {DURATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <ActionButton
                className="w-full justify-center"
                onClick={() => void handleApply()}
                disabled={busyAction !== "" && busyAction !== "refresh"}
              >
                {busyAction === "apply" ? "Applying..." : "Apply Runtime Mode"}
              </ActionButton>
              <ActionButton
                variant="secondary"
                className="w-full justify-center"
                onClick={() => void handleLoad()}
                disabled={!draft.model || (busyAction !== "" && busyAction !== "refresh")}
              >
                {busyAction === "load" ? "Loading..." : "Load Selected Now"}
              </ActionButton>
              <ActionButton
                variant="secondary"
                className="w-full justify-center"
                onClick={() => void handleUnload()}
                disabled={!draft.model || (busyAction !== "" && busyAction !== "refresh")}
              >
                {busyAction === "unload" ? "Unloading..." : "Unload Selected"}
              </ActionButton>
            </div>

            {errorMessage || runtime?.last_runtime_error ? (
              <div className="rounded-[20px] border border-[rgba(239,90,90,0.24)] bg-[rgba(239,90,90,0.08)] px-4 py-3 text-sm leading-6 text-[#f4c9c9]">
                {errorMessage || runtime?.last_runtime_error}
              </div>
            ) : null}

            {!errorMessage && statusMessage ? (
              <div className="rounded-[20px] border border-[rgba(128,120,58,0.24)] bg-[rgba(128,120,58,0.08)] px-4 py-3 text-sm leading-6 text-primary">
                {statusMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <DataBadge tone={draft.enabled ? "success" : "neutral"}>
                Draft resident mode {draft.enabled ? "on" : "off"}
              </DataBadge>
              {draft.model ? (
                <DataBadge tone="neutral">Selected {draft.model}</DataBadge>
              ) : null}
              {managedEnabled && managedModel ? (
                <DataBadge tone="olive">Persisted {managedModel}</DataBadge>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--border-soft)] px-6 py-5">
            <h2 className="font-headline text-[1.45rem] font-bold tracking-[-0.04em] text-foreground">
              Loaded Runners
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Live models currently present in Ollama memory.
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-sm text-muted-foreground">Loading runtime state...</div>
          ) : runningModels.length === 0 ? (
            <EmptyState
              className="m-6"
              title="No runners loaded"
              description="Load one manually or enable resident mode to keep a model warm."
            />
          ) : (
            <div className="space-y-3 px-4 py-4">
              {runningModels.map((model) => {
                const modelName = model.name || model.model || "Unknown model";
                const isManaged = managedEnabled && managedModel === modelName;

                return (
                  <div
                    key={`${modelName}-${model.digest ?? "runtime"}`}
                    className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-muted)] p-5"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-headline text-[1.15rem] font-bold tracking-[-0.035em] text-foreground">
                          {modelName}
                        </p>
                        {isManaged ? <DataBadge tone="success">Managed</DataBadge> : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {model.details?.parameter_size ? (
                          <DataBadge tone="olive">{model.details.parameter_size}</DataBadge>
                        ) : null}
                        {model.details?.quantization_level ? (
                          <DataBadge tone="neutral">{model.details.quantization_level}</DataBadge>
                        ) : null}
                        {model.size_vram ? (
                          <DataBadge tone="neutral">VRAM {formatBytes(model.size_vram)}</DataBadge>
                        ) : null}
                        {model.size ? (
                          <DataBadge tone="neutral">Total {formatBytes(model.size)}</DataBadge>
                        ) : null}
                      </div>

                      <p className="text-sm text-muted-foreground">{runtimeExpiryLabel(model)}</p>

                      <ActionButton
                        variant="secondary"
                        className="w-full justify-center"
                        onClick={() => void handleUnload(modelName)}
                        disabled={busyAction !== "" && busyAction !== "refresh"}
                      >
                        Unload Runner
                      </ActionButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function hydrateDraft(
  runtime: RuntimeStateResponse | null,
  models: ModelSummary[],
  currentSelection: string
): DraftState {
  const fallbackModel =
    currentSelection ||
    runtime?.keep_alive_model ||
    models.find((model) => Boolean(model.is_default_chat))?.ollama_name ||
    models.find((model) => Boolean(model.can_chat))?.ollama_name ||
    "";

  return {
    enabled: runtime?.keep_alive_enabled ?? false,
    model: fallbackModel,
    duration: runtime?.keep_alive_duration || "5m",
  };
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Panel className="p-5">
      <p className="font-label text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-4 font-headline text-[1.75rem] font-black tracking-[-0.05em] text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </Panel>
  );
}

function runtimeExpiryLabel(model: RuntimeModelInfo) {
  if (!model.expires_at) {
    return "Loaded in memory";
  }

  const expiresAt = new Date(model.expires_at);
  if (Number.isNaN(expiresAt.getTime())) {
    return "Loaded in memory";
  }

  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) {
    return "Loaded, pending unload";
  }

  const minutes = Math.round(diffMs / 60000);
  if (minutes >= 525600) {
    return "Resident in memory";
  }
  if (minutes < 1) {
    return "Loaded, expires in under a minute";
  }
  if (minutes < 60) {
    return `Loaded, expires in ${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  return `Loaded, expires in ${hours}h`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
