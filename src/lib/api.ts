export type HealthResponse = {
  status: string;
  version: string;
  ollama: { connected: boolean; model_count: number };
};

export type ApiKeySummary = {
  id: string;
  label: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked: number | boolean;
};

export type ModelSummary = {
  id: string;
  ollama_name: string;
  display_name: string;
  can_chat: number | boolean;
  can_embed: number | boolean;
  is_default_chat: number | boolean;
  is_default_embed: number | boolean;
  model_size: string | null;
};

export type AssistantSummary = {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  model_id: string | null;
  embedding_model_id: string | null;
  retrieval_top_k: number;
  similarity_threshold: number;
  created_at: string;
  updated_at: string;
  document_count: number;
};

export type DocumentSummary = {
  id: string;
  original_filename: string;
  file_type: string;
  file_size_bytes: number;
  status: string;
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  indexed_at: string | null;
};

export type LogSummary = {
  id: string;
  endpoint: string;
  method: string;
  model_used: string | null;
  origin: string;
  status_code: number;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

export type SettingsResponse = {
  ollama_base_url: string;
};

export type RuntimeModelInfo = {
  name: string;
  model?: string;
  size?: number;
  size_vram?: number;
  digest?: string;
  expires_at?: string | null;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
    format?: string;
  };
};

export type RuntimeStateResponse = {
  ollama_version: string | null;
  runtime_strategy: string | null;
  last_runtime_error: string | null;
  keep_alive_enabled: boolean;
  keep_alive_model: string | null;
  keep_alive_duration: string;
  running_models: RuntimeModelInfo[];
};

let apiBase = "http://127.0.0.1:52411";

export function setApiBase(nextBase: string) {
  apiBase = nextBase.replace(/\/$/, "");
}

export function getApiBase() {
  return apiBase;
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const directDetail = record.detail;
    const directError = record.error;

    if (typeof directDetail === "string" && directDetail.trim()) {
      return directDetail;
    }

    if (directDetail && typeof directDetail === "object") {
      const detailRecord = directDetail as Record<string, unknown>;
      if (typeof detailRecord.message === "string" && detailRecord.message.trim()) {
        return detailRecord.message;
      }
      if (detailRecord.error && typeof detailRecord.error === "object") {
        const nestedError = detailRecord.error as Record<string, unknown>;
        if (typeof nestedError.message === "string" && nestedError.message.trim()) {
          return nestedError.message;
        }
      }
    }

    if (typeof directError === "string" && directError.trim()) {
      return directError;
    }

    if (directError && typeof directError === "object") {
      const errorRecord = directError as Record<string, unknown>;
      if (typeof errorRecord.message === "string" && errorRecord.message.trim()) {
        return errorRecord.message;
      }
    }

    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
  }

  return fallback;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractErrorMessage(error, res.statusText));
  }
  return res.json();
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  // API Keys
  listKeys: () => request<{ keys: ApiKeySummary[] }>("/api/keys"),
  createKey: (label: string) => request<{ id: string; key: string }>("/api/keys", {
    method: "POST",
    body: JSON.stringify({ label }),
  }),
  revokeKey: (id: string) => request<{ status: string }>(`/api/keys/${id}`, { method: "DELETE" }),

  // Models
  listModels: () => request<{ models: ModelSummary[] }>("/api/models"),
  syncModels: () => request<{ synced: number }>("/api/models/sync", { method: "POST" }),
  setDefaultChat: (id: string) =>
    request<{ status: string }>(`/api/models/${id}/set-default-chat`, { method: "POST" }),
  setDefaultEmbed: (id: string) =>
    request<{ status: string }>(`/api/models/${id}/set-default-embed`, { method: "POST" }),

  // Assistants
  listAssistants: () => request<{ assistants: AssistantSummary[] }>("/api/assistants"),
  getAssistant: (id: string) => request<AssistantSummary>(`/api/assistants/${id}`),
  createAssistant: (data: {
    name: string;
    description?: string;
    system_prompt?: string;
    model_id?: string;
    embedding_model_id?: string;
    retrieval_top_k?: number;
    similarity_threshold?: number;
  }) =>
    request<{ id: string; name: string; status: string }>("/api/assistants", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAssistant: (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      system_prompt: string;
      model_id: string;
      embedding_model_id: string;
      retrieval_top_k: number;
      similarity_threshold: number;
    }>
  ) =>
    request<{ status: string }>(`/api/assistants/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteAssistant: (id: string) =>
    request<{ status: string }>(`/api/assistants/${id}`, { method: "DELETE" }),

  // Documents
  listDocuments: (assistantId: string) =>
    request<{ documents: DocumentSummary[] }>(`/api/documents/by-assistant/${assistantId}`),
  uploadDocument: async (assistantId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${apiBase}/api/documents/upload/${assistantId}`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || res.statusText);
    }
    return res.json();
  },
  deleteDocument: (id: string) =>
    request<{ status: string }>(`/api/documents/${id}`, { method: "DELETE" }),

  // Logs
  listLogs: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ logs: LogSummary[]; total: number }>(`/api/logs${query}`);
  },
  getLog: (id: string) => request<LogSummary>(`/api/logs/${id}`),
  getStats: () =>
    request<{
      total_requests: number;
      requests_today: number;
      avg_latency_24h: number;
      error_rate_24h: number;
      active_keys: number;
      models_available: number;
      assistants_count: number;
      documents_indexed: number;
    }>("/api/logs/stats/overview"),

  // Settings
  getSettings: () => request<SettingsResponse>("/api/settings"),
  updateSettings: (ollamaBaseUrl: string) =>
    request<{ status: string; ollama_base_url: string }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ ollama_base_url: ollamaBaseUrl }),
    }),

  // Runtime
  getRuntimeState: () => request<RuntimeStateResponse>("/api/runtime"),
  updateRuntimeState: (payload: {
    keep_alive_enabled: boolean;
    keep_alive_model: string | null;
    keep_alive_duration: string;
  }) =>
    request<RuntimeStateResponse>("/api/runtime", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  loadRuntimeModel: (model: string, keepAlive: string | number = "-1") =>
    request<{ status: string }>("/api/runtime/load", {
      method: "POST",
      body: JSON.stringify({ model, keep_alive: keepAlive }),
    }),
  unloadRuntimeModel: (model: string) =>
    request<{ status: string }>("/api/runtime/unload", {
      method: "POST",
      body: JSON.stringify({ model }),
    }),
};
