import { useEffect, useState } from "react";
import { Clock3, Filter, Server } from "lucide-react";
import { api, type LogSummary } from "@/lib/api";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/time";
import {
  DataBadge,
  EmptyState,
  PageHeader,
  Panel,
  surfaceClasses,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export default function Logs() {
  const [logs, setLogs] = useState<LogSummary[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    endpoint: "",
    origin: "",
    status: "",
  });

  async function loadLogs() {
    setLoading(true);
    try {
      const response = await api.listLogs(
        Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value.trim().length > 0)
        )
      );
      setLogs(response.logs);
      setSelectedLog((current) =>
        current ? response.logs.find((entry) => entry.id === current.id) ?? null : null
      );
    } catch {
      setLogs([]);
      setSelectedLog(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [filters.endpoint, filters.origin, filters.status]);

  async function handleSelectLog(id: string) {
    const detail = await api.getLog(id);
    setSelectedLog(detail);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-8">
      <PageHeader
        eyebrow="Gateway Activity"
        title="Logs"
        description="Filter request history, inspect failures, and trace the local gateway’s recent traffic."
      />

      <Panel className="mb-6 p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <label className="space-y-2">
            <span className="font-label inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Endpoint filter
            </span>
            <input
              type="text"
              value={filters.endpoint}
              onChange={(event) =>
                setFilters((current) => ({ ...current, endpoint: event.currentTarget.value }))
              }
              placeholder="Filter by endpoint"
              className={surfaceClasses.input}
            />
          </label>
          <label className="space-y-2">
            <span className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Origin
            </span>
            <select
              value={filters.origin}
              onChange={(event) =>
                setFilters((current) => ({ ...current, origin: event.currentTarget.value }))
              }
              className={surfaceClasses.select}
            >
              <option value="">All origins</option>
              <option value="local">Local</option>
              <option value="remote">Remote</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Result
            </span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.currentTarget.value }))
              }
              className={surfaceClasses.select}
            >
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
          </label>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_380px]">
        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--border-soft)] px-6 py-5">
            <h2 className="font-headline text-2xl font-bold tracking-[-0.04em] text-foreground">
              Request History
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select any request to inspect the full event detail.
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Loading request history...
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              className="m-6"
              title="No requests recorded"
              description="Use an API key or the playground to create the first gateway events."
            />
          ) : (
            <div className="space-y-2 px-4 py-4">
              {logs.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => void handleSelectLog(log.id)}
                  className={cn(
                    "w-full rounded-[24px] border px-5 py-4 text-left transition-all",
                    selectedLog?.id === log.id
                      ? "border-primary bg-[rgba(128,120,58,0.1)]"
                      : "border-[var(--border-soft)] bg-[var(--surface-muted)] hover:bg-[var(--surface-raised)]"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        log.status_code < 400
                          ? "bg-[rgba(128,120,58,0.16)] text-primary"
                          : "bg-[rgba(239,90,90,0.16)] text-destructive"
                      )}
                    >
                      <Server className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-mono truncate text-xs text-foreground">{log.endpoint}</p>
                        <DataBadge tone={log.status_code < 400 ? "success" : "danger"}>
                          {log.status_code}
                        </DataBadge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{log.method}</span>
                        <span>{log.model_used ?? "No model"}</span>
                        <span>{log.latency_ms ? `${log.latency_ms}ms` : "No latency"}</span>
                        <span>{formatRelativeTime(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel variant="hero" className="p-6">
          {selectedLog ? (
            <>
              <DataBadge tone={selectedLog.status_code < 400 ? "success" : "danger"}>
                {selectedLog.status_code < 400 ? "Healthy Request" : "Failed Request"}
              </DataBadge>
              <h2 className="font-headline mt-4 text-3xl font-black tracking-[-0.05em] text-foreground">
                Request Detail
              </h2>
              <div className="mt-6 space-y-3">
                <DetailRow label="Endpoint" value={selectedLog.endpoint} mono />
                <DetailRow label="Method" value={selectedLog.method} />
                <DetailRow label="Origin" value={selectedLog.origin} />
                <DetailRow label="Model" value={selectedLog.model_used ?? "—"} mono />
                <DetailRow
                  label="Latency"
                  value={selectedLog.latency_ms ? `${selectedLog.latency_ms}ms` : "—"}
                />
                <DetailRow
                  label="Prompt Tokens"
                  value={selectedLog.prompt_tokens?.toString() ?? "—"}
                />
                <DetailRow
                  label="Completion Tokens"
                  value={selectedLog.completion_tokens?.toString() ?? "—"}
                />
                <DetailRow
                  label="Total Tokens"
                  value={selectedLog.total_tokens?.toString() ?? "—"}
                />
                <DetailRow
                  label="Occurred"
                  value={formatAbsoluteTime(selectedLog.created_at)}
                  icon={Clock3}
                />
                {selectedLog.error_message ? (
                  <DetailRow label="Error" value={selectedLog.error_message} />
                ) : null}
              </div>
            </>
          ) : (
            <EmptyState
              className="min-h-[420px]"
              title="Select a request"
              description="Choose an entry from the request history to inspect its payload summary and timing."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
  icon: Icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: typeof Clock3;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-4">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
        <p className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className={cn("mt-3 text-sm text-foreground", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}
