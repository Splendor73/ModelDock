import { useEffect, useMemo, useState } from "react";
import { Cpu, RefreshCw } from "lucide-react";
import { api, type ModelSummary } from "@/lib/api";
import {
  ActionButton,
  DataBadge,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export default function Models() {
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? models[0] ?? null,
    [models, selectedModelId]
  );

  async function loadModels() {
    try {
      const data = await api.listModels();
      setModels(data.models);
      setSelectedModelId((current) => current ?? data.models[0]?.id ?? null);
    } catch {
      setModels([]);
      setSelectedModelId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadModels();
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await api.syncModels();
      await loadModels();
    } finally {
      setSyncing(false);
    }
  }

  async function handleSetDefaultChat(id: string) {
    await api.setDefaultChat(id);
    await loadModels();
  }

  async function handleSetDefaultEmbed(id: string) {
    await api.setDefaultEmbed(id);
    await loadModels();
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-8">
      <PageHeader
        eyebrow="Model Inventory"
        title="Models"
        description="Sync local Ollama tags, review capabilities, and assign defaults for chat and embeddings."
        actions={
          <ActionButton variant="secondary" icon={RefreshCw} onClick={() => void handleSync()} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync Models"}
          </ActionButton>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--border-soft)] px-6 py-5">
            <h2 className="font-headline text-2xl font-bold tracking-[-0.04em] text-foreground">
              Local Inventory
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Live model tags discovered from Ollama.
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Loading models...
            </div>
          ) : models.length === 0 ? (
            <EmptyState
              className="m-6"
              title="No models available"
              description="Make sure Ollama is running, pull at least one model, then sync the local inventory."
            />
          ) : (
            <div className="space-y-2 px-4 py-4">
              {models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedModelId(model.id)}
                  className={cn(
                    "w-full rounded-[24px] border px-5 py-4 text-left transition-all",
                    model.id === selectedModel?.id
                      ? "border-primary bg-[rgba(128,120,58,0.1)] shadow-[inset_0_0_0_1px_rgba(128,120,58,0.1)]"
                      : "border-[var(--border-soft)] bg-[var(--surface-muted)] hover:bg-[var(--surface-raised)]"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-sm text-foreground">{model.ollama_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {model.model_size ?? "Unknown size"}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {Boolean(model.can_chat) ? <DataBadge tone="olive">Chat</DataBadge> : null}
                      {Boolean(model.can_embed) ? <DataBadge tone="lilac">Embed</DataBadge> : null}
                      {Boolean(model.is_default_chat) ? <DataBadge tone="success">Default Chat</DataBadge> : null}
                      {Boolean(model.is_default_embed) ? <DataBadge tone="success">Default Embed</DataBadge> : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel variant="hero" className="p-6">
          {selectedModel ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DataBadge tone="olive">
                    {Boolean(selectedModel.is_default_chat) ? "Primary Chat Route" : "Selectable"}
                  </DataBadge>
                  <h2 className="font-headline mt-4 text-4xl font-black tracking-[-0.06em] text-foreground">
                    {selectedModel.display_name || selectedModel.ollama_name}
                  </h2>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    {selectedModel.ollama_name}
                  </p>
                </div>
                <div className="rounded-[22px] bg-[rgba(128,120,58,0.14)] p-4 text-primary">
                  <Cpu className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <InfoTile label="Model Size" value={selectedModel.model_size ?? "Unknown"} />
                <InfoTile
                  label="Mode"
                  value={
                    Boolean(selectedModel.can_chat) && Boolean(selectedModel.can_embed)
                      ? "Chat + Embed"
                      : Boolean(selectedModel.can_chat)
                        ? "Chat"
                        : Boolean(selectedModel.can_embed)
                          ? "Embed"
                          : "Unknown"
                  }
                />
                <InfoTile
                  label="Chat Default"
                  value={Boolean(selectedModel.is_default_chat) ? "Assigned" : "Inactive"}
                />
                <InfoTile
                  label="Embed Default"
                  value={Boolean(selectedModel.is_default_embed) ? "Assigned" : "Inactive"}
                />
              </div>

              <div className="mt-6 space-y-3">
                {Boolean(selectedModel.can_chat) && !Boolean(selectedModel.is_default_chat) ? (
                  <ActionButton className="w-full" onClick={() => void handleSetDefaultChat(selectedModel.id)}>
                    Set Chat Default
                  </ActionButton>
                ) : null}
                {Boolean(selectedModel.can_embed) && !Boolean(selectedModel.is_default_embed) ? (
                  <ActionButton
                    variant="secondary"
                    className="w-full"
                    onClick={() => void handleSetDefaultEmbed(selectedModel.id)}
                  >
                    Set Embedding Default
                  </ActionButton>
                ) : null}
                {(Boolean(selectedModel.is_default_chat) || Boolean(selectedModel.is_default_embed)) && (
                  <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-4 text-sm text-muted-foreground">
                    This model is already active in the local routing configuration.
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              title="Select a model"
              description="Choose a synced model to inspect its capabilities and configure its routing role."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-4">
      <p className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
