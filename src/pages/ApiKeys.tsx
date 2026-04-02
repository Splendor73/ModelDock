import { useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, Plus, Shield, Trash2 } from "lucide-react";
import { api, type ApiKeySummary } from "@/lib/api";
import { useDesktop } from "@/context/AppContext";
import {
  ActionButton,
  DataBadge,
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  surfaceClasses,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export default function ApiKeys() {
  const { backend } = useDesktop();
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const activeKeys = useMemo(
    () => keys.filter((key) => !Boolean(key.revoked)),
    [keys]
  );

  async function loadKeys() {
    try {
      const data = await api.listKeys();
      setKeys(data.keys);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadKeys();
  }, []);

  async function handleCreate() {
    if (!newLabel.trim()) {
      return;
    }

    const result = await api.createKey(newLabel.trim());
    setCreatedKey(result.key);
    setNewLabel("");
    setShowCreate(false);
    await loadKeys();
  }

  async function handleRevoke(id: string) {
    await api.revokeKey(id);
    await loadKeys();
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-8">
      <PageHeader
        eyebrow="OpenAI Surface"
        title="API Keys"
        description="Issue local credentials for client applications, monitor last-used activity, and keep the gateway’s auth layer tight."
        actions={
          <ActionButton icon={Plus} onClick={() => setShowCreate(true)}>
            Create Key
          </ActionButton>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          label="Active Keys"
          value={activeKeys.length}
          detail="Ready for application traffic"
          icon={KeyRound}
          accent="primary"
        />
        <MetricCard
          label="Revoked"
          value={keys.length - activeKeys.length}
          detail="Removed from local access"
          icon={Trash2}
          accent="secondary"
        />
        <MetricCard
          label="Gateway Endpoint"
          value={`:${backend?.port ?? 52411}`}
          detail="Current local OpenAI-compatible port"
          icon={Shield}
          accent="tertiary"
        />
      </div>

      {createdKey ? (
        <Panel variant="hero" className="mb-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DataBadge tone="olive">Copy Once</DataBadge>
              <h2 className="font-headline mt-4 text-3xl font-black tracking-[-0.05em] text-foreground">
                New key created
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This secret will not be shown again after you dismiss it.
              </p>
            </div>
            <ActionButton variant="secondary" onClick={() => setCreatedKey(null)}>
              Dismiss
            </ActionButton>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <code className="block flex-1 overflow-x-auto rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-4 font-mono text-xs text-foreground">
              {createdKey}
            </code>
            <ActionButton
              variant="secondary"
              className="h-12 w-12 px-0 py-0"
              icon={copied ? Check : Copy}
              onClick={() => void handleCopy(createdKey)}
              aria-label="Copy key"
            />
          </div>
        </Panel>
      ) : null}

      {showCreate ? (
        <Panel className="mb-6 p-6">
          <h2 className="font-headline text-2xl font-bold tracking-[-0.04em] text-foreground">
            Create a local key
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Give the key a short label so you can identify its owning app later.
          </p>
          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              placeholder="Key label, for example local-chat-client"
              value={newLabel}
              onChange={(event) => setNewLabel(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleCreate();
                }
              }}
              className={cn(surfaceClasses.input, "flex-1")}
              autoFocus
            />
            <ActionButton onClick={() => void handleCreate()}>Create</ActionButton>
            <ActionButton variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </ActionButton>
          </div>
        </Panel>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_440px] 2xl:grid-cols-[minmax(0,1.25fr)_500px]">
        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--border-soft)] px-6 py-5">
            <h2 className="font-headline text-2xl font-bold tracking-[-0.04em] text-foreground">
              Local Secrets
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keys currently recognized by the local gateway.
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Loading keys...
            </div>
          ) : keys.length === 0 ? (
            <EmptyState
              className="m-6"
              title="No API keys yet"
              description="Create one local key to start sending OpenAI-compatible requests through ModelDock."
            />
          ) : (
            <div className="overflow-x-auto px-4 py-4">
              <table className="w-full border-separate border-spacing-y-2 text-left">
                <thead>
                  <tr>
                    <TableHead>Label</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead align="right">Action</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id} className="bg-[var(--surface-muted)] transition-colors hover:bg-[var(--surface-raised)]">
                      <td className="rounded-l-[22px] px-5 py-4 font-medium text-foreground">
                        {key.label}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                        {key.key_prefix}...
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {new Date(key.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-5 py-4">
                        <DataBadge tone={Boolean(key.revoked) ? "danger" : "success"}>
                          {Boolean(key.revoked) ? "Revoked" : "Active"}
                        </DataBadge>
                      </td>
                      <td className="rounded-r-[22px] px-5 py-4 text-right">
                        {!Boolean(key.revoked) ? (
                          <button
                            type="button"
                            onClick={() => void handleRevoke(key.id)}
                            className={surfaceClasses.iconButton}
                            title="Revoke key"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel variant="hero" className="p-6">
          <DataBadge tone="neutral">Quickstart</DataBadge>
          <h2 className="font-headline mt-4 text-3xl font-black tracking-[-0.05em] text-foreground">
            Client snippet
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Point your OpenAI SDK at the local gateway and use the secret created here.
          </p>
          <pre className="mt-5 min-h-[280px] overflow-x-auto rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 font-mono text-[11px] leading-6 text-foreground">
{`from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:${backend?.port ?? 52411}/v1",
    api_key="your-key-here"
)

response = client.chat.completions.create(
    model="llama3.2:3b",
    messages=[{"role": "user", "content": "Hello!"}]
)`}
          </pre>
        </Panel>
      </div>
    </div>
  );
}

function TableHead({
  children,
  align = "left",
}: {
  children: string;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "font-label px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      {children}
    </th>
  );
}
