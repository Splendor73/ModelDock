import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { Bot, FileUp, Trash2 } from "lucide-react";
import {
  api,
  type AssistantSummary,
  type DocumentSummary,
  type ModelSummary,
} from "@/lib/api";
import {
  ActionButton,
  DataBadge,
  EmptyState,
  PageHeader,
  Panel,
  surfaceClasses,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type AssistantFormState = {
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  embeddingModelId: string;
};

const initialFormState: AssistantFormState = {
  name: "",
  description: "",
  systemPrompt:
    "You are a helpful assistant. Answer questions based only on the provided context.",
  modelId: "",
  embeddingModelId: "",
};

export default function Assistants() {
  const [assistants, setAssistants] = useState<AssistantSummary[]>([]);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const selectedAssistant = useMemo(
    () => assistants.find((assistant) => assistant.id === selectedAssistantId) ?? null,
    [assistants, selectedAssistantId]
  );

  const chatModels = models.filter((model) => Boolean(model.can_chat));
  const embedModels = models.filter((model) => Boolean(model.can_embed));

  async function loadAssistants() {
    try {
      const response = await api.listAssistants();
      setAssistants(response.assistants);
      setSelectedAssistantId((currentId) => currentId ?? response.assistants[0]?.id ?? null);
    } catch {
      setAssistants([]);
      setSelectedAssistantId(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadModels() {
    try {
      const response = await api.listModels();
      setModels(response.models);
    } catch {
      setModels([]);
    }
  }

  async function loadDocuments(assistantId: string) {
    try {
      const response = await api.listDocuments(assistantId);
      setDocuments(response.documents);
    } catch {
      setDocuments([]);
    }
  }

  useEffect(() => {
    void loadAssistants();
    void loadModels();
  }, []);

  useEffect(() => {
    if (!selectedAssistantId) {
      setDocuments([]);
      return;
    }

    void loadDocuments(selectedAssistantId);
  }, [selectedAssistantId]);

  async function handleCreateAssistant() {
    if (!formState.name.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.createAssistant({
        name: formState.name.trim(),
        description: formState.description.trim() || undefined,
        system_prompt: formState.systemPrompt.trim() || undefined,
        model_id: formState.modelId || undefined,
        embedding_model_id: formState.embeddingModelId || undefined,
      });
      setFormState(initialFormState);
      await loadAssistants();
      setSelectedAssistantId(response.id);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAssistant(id: string) {
    await api.deleteAssistant(id);
    await loadAssistants();
  }

  async function handleUploadDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file || !selectedAssistantId) {
      return;
    }

    setUploading(true);
    try {
      await api.uploadDocument(selectedAssistantId, file);
      await loadDocuments(selectedAssistantId);
      await loadAssistants();
    } finally {
      setUploading(false);
      event.currentTarget.value = "";
    }
  }

  async function handleDeleteDocument(documentId: string) {
    await api.deleteDocument(documentId);
    if (selectedAssistantId) {
      await loadDocuments(selectedAssistantId);
      await loadAssistants();
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-8">
      <PageHeader
        eyebrow="Knowledge Workspace"
        title="Assistants"
        description="Create assistants, bind models, attach source documents, and manage each retrieval-driven workspace from one view."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-[18px] bg-[rgba(128,120,58,0.16)] p-3 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-headline text-2xl font-bold tracking-[-0.04em] text-foreground">
                  Create assistant
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep it focused on one document collection.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Assistant name">
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, name: event.currentTarget.value }))
                  }
                  placeholder="Assistant name"
                  className={surfaceClasses.input}
                />
              </Field>

              <Field label="Short description">
                <textarea
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      description: event.currentTarget.value,
                    }))
                  }
                  placeholder="What is this assistant for?"
                  rows={4}
                  className={surfaceClasses.textarea}
                />
              </Field>

              <Field label="System prompt">
                <textarea
                  value={formState.systemPrompt}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      systemPrompt: event.currentTarget.value,
                    }))
                  }
                  rows={5}
                  className={surfaceClasses.textarea}
                />
              </Field>

              <Field label="Default chat model">
                <select
                  value={formState.modelId}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, modelId: event.currentTarget.value }))
                  }
                  className={surfaceClasses.select}
                >
                  <option value="">Use global default</option>
                  {chatModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.ollama_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Default embedding model">
                <select
                  value={formState.embeddingModelId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      embeddingModelId: event.currentTarget.value,
                    }))
                  }
                  className={surfaceClasses.select}
                >
                  <option value="">Use global default</option>
                  {embedModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.ollama_name}
                    </option>
                  ))}
                </select>
              </Field>

              <ActionButton className="w-full" onClick={() => void handleCreateAssistant()} disabled={submitting}>
                {submitting ? "Creating..." : "Create Assistant"}
              </ActionButton>
            </div>
          </Panel>

          <Panel className="p-6">
            <h3 className="font-headline text-2xl font-bold tracking-[-0.04em] text-foreground">
              Existing assistants
            </h3>
            {loading ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading assistants...</p>
            ) : assistants.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No assistants yet. Create one to begin attaching documents.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {assistants.map((assistant) => (
                  <div
                    key={assistant.id}
                    onClick={() => setSelectedAssistantId(assistant.id)}
                    className={cn(
                      "w-full cursor-pointer rounded-[22px] border px-4 py-4 text-left transition-all",
                      assistant.id === selectedAssistant?.id
                        ? "border-primary bg-[rgba(128,120,58,0.1)]"
                        : "border-[var(--border-soft)] bg-[var(--surface-muted)] hover:bg-[var(--surface-raised)]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{assistant.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {assistant.document_count} document
                          {assistant.document_count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteAssistant(assistant.id);
                        }}
                        className={surfaceClasses.iconButton}
                        title="Delete assistant"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <Panel variant="hero" className="p-6">
          {selectedAssistant ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] pb-5">
                <div>
                  <DataBadge tone="olive">Selected Workspace</DataBadge>
                  <h2 className="font-headline mt-4 text-4xl font-black tracking-[-0.05em] text-foreground">
                    {selectedAssistant.name}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                    {selectedAssistant.description || "No description yet."}
                  </p>
                </div>
                <label className="cursor-pointer">
                  <ActionButton variant="secondary" icon={FileUp} className="pointer-events-none" disabled={uploading}>
                    {uploading ? "Uploading..." : "Upload Document"}
                  </ActionButton>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleUploadDocument}
                    accept=".pdf,.md,.txt,.docx"
                  />
                </label>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <InfoTile label="Chat Model" value={selectedAssistant.model_id || "Global default"} />
                <InfoTile
                  label="Embed Model"
                  value={selectedAssistant.embedding_model_id || "Global default"}
                />
                <InfoTile
                  label="Similarity"
                  value={selectedAssistant.similarity_threshold.toString()}
                />
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-headline text-2xl font-bold tracking-[-0.04em] text-foreground">
                      Documents
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Upload PDF, Markdown, TXT, or DOCX files into this assistant.
                    </p>
                  </div>
                  <DataBadge tone="neutral">
                    {documents.length} file{documents.length === 1 ? "" : "s"}
                  </DataBadge>
                </div>

                {documents.length === 0 ? (
                  <EmptyState
                    className="mt-5 min-h-72"
                    title="No documents uploaded"
                    description="Attach source files to give this assistant retrieval context."
                  />
                ) : (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full border-separate border-spacing-y-2 text-left">
                      <thead>
                        <tr>
                          <TableHead>File</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead align="right">Action</TableHead>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((document) => (
                          <tr key={document.id} className="bg-[var(--surface-muted)] transition-colors hover:bg-[var(--surface-raised)]">
                            <td className="rounded-l-[22px] px-5 py-4 text-sm text-foreground">
                              {document.original_filename}
                            </td>
                            <td className="px-5 py-4 text-xs uppercase text-muted-foreground">
                              {document.file_type}
                            </td>
                            <td className="px-5 py-4">
                              <DataBadge tone="neutral">{document.status}</DataBadge>
                            </td>
                            <td className="px-5 py-4 text-sm text-muted-foreground">
                              {formatBytes(document.file_size_bytes)}
                            </td>
                            <td className="rounded-r-[22px] px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => void handleDeleteDocument(document.id)}
                                className={surfaceClasses.iconButton}
                                title="Delete document"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              className="min-h-[720px]"
              title="Select an assistant"
              description="Choose a workspace from the left or create a new one to begin attaching documents."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-4">
      <p className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-sm text-foreground">{value}</p>
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

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
