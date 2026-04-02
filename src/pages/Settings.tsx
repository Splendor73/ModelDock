import { useEffect, useState } from "react";
import { HardDrive, RefreshCw, Settings2 } from "lucide-react";
import { api } from "@/lib/api";
import { useDesktop } from "@/context/AppContext";
import {
  ActionButton,
  DataBadge,
  PageHeader,
  Panel,
  surfaceClasses,
} from "@/components/ui/primitives";

export default function Settings() {
  const { backend, health, refreshHealth, restartBackend } = useDesktop();
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    void api.getSettings().then((response) => setOllamaBaseUrl(response.ollama_base_url));
  }, []);

  async function handleSave() {
    if (!ollamaBaseUrl.trim()) {
      return;
    }

    setSaving(true);
    try {
      const response = await api.updateSettings(ollamaBaseUrl.trim());
      setOllamaBaseUrl(response.ollama_base_url);
      setSaveMessage("Saved local settings.");
      await refreshHealth();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-8">
      <PageHeader
        eyebrow="Runtime Controls"
        title="Settings"
        description="Inspect the local desktop runtime, update the Ollama endpoint, and restart the gateway when the environment changes."
        actions={
          <ActionButton variant="secondary" icon={RefreshCw} onClick={() => void restartBackend()}>
            Restart Backend
          </ActionButton>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RuntimeOverviewCard
          label="Backend"
          value={backend?.running ? "Ready" : "Offline"}
          detail={backend?.port ? `Port ${backend.port}` : "No bound port"}
          icon={Settings2}
          tone="primary"
        />
        <RuntimeOverviewCard
          label="Ollama"
          value={health?.ollama.connected ? "Connected" : "Unavailable"}
          detail={
            health?.ollama.connected
              ? `${health.ollama.model_count} models visible`
              : "Not reachable from backend"
          }
          icon={RefreshCw}
          tone="secondary"
        />
        <RuntimeOverviewCard
          label="App Version"
          value={health?.version ?? "Unknown"}
          detail="Reported by backend health route"
          icon={Settings2}
          tone="tertiary"
        />
        <RuntimeOverviewCard
          label="Storage"
          value={backend?.dataDir ? "Configured" : "Unavailable"}
          detail="ModelDock data directory is available locally"
          icon={HardDrive}
          tone="secondary"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <Panel className="p-6">
          <h2 className="font-headline text-2xl font-bold tracking-[-0.04em] text-foreground">
            Backend Runtime
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SettingTile label="Status" value={backend?.running ? "Running" : "Offline"} />
            <SettingTile label="Port" value={backend?.port ? backend.port.toString() : "Unknown"} />
            <SettingTile label="Version" value={health?.version ?? "Unknown"} />
            <SettingTile label="Data Directory" value={backend?.dataDir ?? "Unavailable"} />
          </div>
        </Panel>

        <Panel variant="hero" className="p-6">
          <DataBadge tone="olive">Local Config</DataBadge>
          <h2 className="font-headline mt-4 text-3xl font-black tracking-[-0.05em] text-foreground">
            Ollama Base URL
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Update the backend’s local Ollama target and refresh health after saving.
          </p>
          <label className="mt-5 block space-y-2">
            <span className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Endpoint
            </span>
            <input
              type="text"
              value={ollamaBaseUrl}
              onChange={(event) => {
                setOllamaBaseUrl(event.currentTarget.value);
                setSaveMessage("");
              }}
              className={surfaceClasses.input}
            />
          </label>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <ActionButton onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </ActionButton>
            {saveMessage ? <span className="text-sm text-muted-foreground">{saveMessage}</span> : null}
          </div>

          <div className="mt-6 rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
            <p className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Current Health
            </p>
            <p className="mt-3 text-sm text-foreground">
              {health?.ollama.connected
                ? `Connected with ${health.ollama.model_count} available models.`
                : "Ollama is currently offline from the backend perspective."}
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function RuntimeOverviewCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Settings2;
  tone: "primary" | "secondary" | "tertiary";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-[rgba(128,120,58,0.16)] text-primary"
      : tone === "tertiary"
        ? "bg-[rgba(154,139,188,0.16)] text-[var(--color-tertiary)]"
        : "bg-[rgba(125,120,90,0.14)] text-[var(--color-secondary)]";

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-label text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </p>
          <p className="font-headline mt-4 text-[clamp(1.55rem,2.2vw,2.15rem)] font-black leading-[0.98] tracking-[-0.045em] text-foreground">
            {value}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
        <div className={`rounded-[18px] p-3 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Panel>
  );
}

function SettingTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
      <p className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 break-words text-sm leading-6 text-foreground">{value}</p>
    </div>
  );
}
