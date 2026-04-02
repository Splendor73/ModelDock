import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, Play, ShieldEllipsis } from "lucide-react";
import { api, getApiBase, type ApiKeySummary, type ModelSummary } from "@/lib/api";
import {
  ActionButton,
  DataBadge,
  EmptyState,
  PageHeader,
  Panel,
  surfaceClasses,
} from "@/components/ui/primitives";

type PlaygroundResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
  error?: {
    message?: string;
  };
  detail?: {
    error?: {
      message?: string;
    };
  };
};

export default function Playground() {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [fullApiKey, setFullApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [prompt, setPrompt] = useState("Summarize what this local gateway is for.");
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeKeys = useMemo(
    () => keys.filter((key) => !Boolean(key.revoked)),
    [keys]
  );
  const chatModels = useMemo(
    () => models.filter((model) => Boolean(model.can_chat)),
    [models]
  );
  const selectedKeyRecord = useMemo(
    () => activeKeys.find((key) => key.id === selectedKey) ?? null,
    [activeKeys, selectedKey]
  );

  useEffect(() => {
    void api.listKeys().then((response) => {
      setKeys(response.keys);
      setSelectedKey(response.keys.find((key) => !Boolean(key.revoked))?.id ?? "");
    });
    void api.listModels().then((response) => {
      setModels(response.models);
      const defaultModel =
        response.models.find((model) => Boolean(model.is_default_chat)) ??
        response.models.find((model) => Boolean(model.can_chat));
      setSelectedModel(defaultModel?.ollama_name ?? "");
    });
  }, []);

  async function handleRun() {
    if (!selectedModel || !prompt.trim() || !fullApiKey.trim()) {
      return;
    }

    const trimmedKey = fullApiKey.trim();
    if (selectedKeyRecord && !trimmedKey.startsWith(selectedKeyRecord.key_prefix)) {
      setResponseText(
        `The pasted secret does not match "${selectedKeyRecord.label}". Expected a key starting with ${selectedKeyRecord.key_prefix}...`
      );
      return;
    }

    setSubmitting(true);
    setResponseText("");

    try {
      const httpResponse = await fetch(`${getApiBase()}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${trimmedKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "user", content: prompt.trim() }],
        }),
      });

      const payload = (await httpResponse.json().catch(() => null)) as PlaygroundResponse | null;
      const errorMessage = getPlaygroundError(httpResponse.ok, payload);
      if (errorMessage) {
        setResponseText(errorMessage);
        return;
      }

      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim()) {
        setResponseText(content);
        return;
      }

      setResponseText(
        payload ? JSON.stringify(payload, null, 2) : "No response content."
      );
    } catch (error) {
      setResponseText(error instanceof Error ? error.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-8">
      <PageHeader
        eyebrow="Manual Validation"
        title="Playground"
        description="Send a direct local chat request through the OpenAI-compatible gateway and inspect the response in the same workspace."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Panel className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-headline text-2xl font-bold tracking-[-0.04em] text-foreground">
                Request Setup
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Configure auth, model, and prompt input.
              </p>
            </div>
            <div className="rounded-[18px] bg-[rgba(128,120,58,0.16)] p-3 text-primary">
              <ShieldEllipsis className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Saved Key Label">
              <select
                value={selectedKey}
                onChange={(event) => setSelectedKey(event.currentTarget.value)}
                className={surfaceClasses.select}
              >
                <option value="">Select an active key</option>
                {activeKeys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.label} ({key.key_prefix}...)
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Full API Key"
              hint="Saved keys only keep prefixes, so paste the full secret created earlier."
            >
              <input
                type="password"
                value={fullApiKey}
                onChange={(event) => setFullApiKey(event.currentTarget.value)}
                placeholder={
                  selectedKey
                    ? "Paste the full secret for the selected key"
                    : "Paste a full API key"
                }
                className={surfaceClasses.input}
              />
            </Field>

            <Field label="Model">
              <select
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.currentTarget.value)}
                className={surfaceClasses.select}
              >
                <option value="">Select a model</option>
                {chatModels.map((model) => (
                  <option key={model.id} value={model.ollama_name}>
                    {model.ollama_name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Prompt">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.currentTarget.value)}
                rows={8}
                className={surfaceClasses.textarea}
              />
            </Field>

            <ActionButton className="w-full" icon={Play} onClick={() => void handleRun()} disabled={submitting}>
              {submitting ? "Running..." : "Send Request"}
            </ActionButton>
          </div>
        </Panel>

        <Panel variant="hero" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <DataBadge tone="neutral">Response Console</DataBadge>
              <h2 className="font-headline mt-4 text-3xl font-black tracking-[-0.05em] text-foreground">
                Local Completion Output
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Results from `/v1/chat/completions` over the local gateway.
              </p>
            </div>
            <div className="rounded-[18px] bg-[rgba(154,139,188,0.16)] p-3 text-[var(--color-tertiary)]">
              <MessageSquareText className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <DataBadge tone="olive">{selectedModel || "No model selected"}</DataBadge>
            <DataBadge tone="neutral">{selectedKey ? "Saved key chosen" : "No saved key"}</DataBadge>
          </div>

          {responseText ? (
            <pre className="mt-5 min-h-[520px] whitespace-pre-wrap rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-muted)] p-5 font-mono text-sm leading-7 text-foreground">
              {responseText}
            </pre>
          ) : (
            <EmptyState
              className="mt-5 min-h-[520px]"
              title="No response yet"
              description="Choose a saved key, paste the full secret, select a model, and run a request to render output here."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function getPlaygroundError(ok: boolean, payload: PlaygroundResponse | null) {
  const message =
    payload?.error?.message ??
    payload?.detail?.error?.message ??
    (typeof payload === "object" && payload && "detail" in payload && typeof payload.detail === "string"
      ? payload.detail
      : null);

  if (!ok) {
    return message ?? "Request failed";
  }

  return message ?? null;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </label>
  );
}
