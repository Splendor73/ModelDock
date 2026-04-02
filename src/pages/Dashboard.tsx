import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Box,
  Clock3,
  FileText,
  Key,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { useDesktop } from "@/context/AppContext";
import { api, type LogSummary, type ModelSummary } from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";
import {
  DataBadge,
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  surfaceClasses,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type DashboardStats = Awaited<ReturnType<typeof api.getStats>>;

export default function Dashboard() {
  const { health } = useDesktop();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<LogSummary[]>([]);
  const [models, setModels] = useState<ModelSummary[]>([]);

  useEffect(() => {
    void Promise.all([
      api.getStats().catch(() => null),
      api.listLogs({ limit: "4" }).catch(() => ({ logs: [] as LogSummary[] })),
      api.listModels().catch(() => ({ models: [] as ModelSummary[] })),
    ]).then(([statsResponse, logsResponse, modelsResponse]) => {
      setStats(statsResponse);
      setRecentLogs(logsResponse.logs);
      setModels(modelsResponse.models);
    });
  }, []);

  const defaultChatModel = useMemo(
    () =>
      models.find((model) => Boolean(model.is_default_chat)) ??
      models.find((model) => Boolean(model.can_chat)) ??
      null,
    [models]
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-8">
      <PageHeader
        eyebrow="Command Center"
        title="System Dashboard"
        description="Real-time inference and routing visibility for the local gateway, model inventory, assistants, and request flow."
        descriptionClassName="max-w-[60ch] text-sm leading-7"
        actions={
          <>
            <Link
              to="/logs"
              className="font-label inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] px-5 py-2.5 text-xs font-semibold text-foreground transition-all hover:bg-[var(--surface-panel-2)]"
            >
              <ArrowUpRight className="h-4 w-4" />
              Inspect Logs
            </Link>
            <Link
              to="/assistants"
              className="font-label inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-[0_16px_34px_rgba(128,120,58,0.22)] transition-all hover:brightness-[1.06]"
            >
              <Bot className="h-4 w-4" />
              New Assistant
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.86fr)_360px]">
        <Panel variant="hero" className="relative overflow-hidden p-6">
          <div className="absolute right-[-44px] top-[-30px] h-44 w-44 rounded-full bg-[rgba(128,120,58,0.12)] blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <DataBadge tone="olive">
                {defaultChatModel ? "Default Chat Model" : "No Default Model"}
              </DataBadge>
              <button className={cn(surfaceClasses.iconButton, "h-10 w-10")}>
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>

            <h2 className="font-headline mt-4 max-w-[11ch] break-words text-[clamp(1.95rem,3.4vw,3rem)] font-black leading-[0.92] tracking-[-0.06em] text-foreground">
              {defaultChatModel?.display_name || defaultChatModel?.ollama_name || "No active model"}
            </h2>
            <p className="mt-2.5 max-w-xl text-sm leading-7 text-muted-foreground">
              {defaultChatModel
                ? `Using ${defaultChatModel.ollama_name} for local chat routing with live backend and assistant workflows.`
                : "Sync local Ollama models and assign a default chat model to turn on the main gateway flow."}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              <HeroStat label="Model Size" value={defaultChatModel?.model_size ?? "Unknown"} />
              <HeroStat
                label="Chat Ready"
                value={defaultChatModel && Boolean(defaultChatModel.can_chat) ? "Enabled" : "No"}
              />
              <HeroStat
                label="Embedding"
                value={
                  defaultChatModel && Boolean(defaultChatModel.can_embed) ? "Available" : "Separate"
                }
              />
            </div>
          </div>
        </Panel>

        <Panel className="flex flex-col gap-3 p-3.5">
          <MetricCard
            label="Requests Today"
            value={stats?.requests_today ?? 0}
            detail={`${stats?.total_requests ?? 0} total requests`}
            icon={Activity}
            accent="primary"
            className="min-h-[172px]"
            valueClassName="text-[clamp(1.55rem,2.4vw,2.2rem)]"
          />

          <MetricCard
            label="Gateway Quality"
            value={`${stats?.avg_latency_24h ?? 0}ms`}
            detail={`${stats?.error_rate_24h ?? 0}% error rate in the last 24h`}
            icon={ShieldCheck}
            accent="secondary"
            className="min-h-[172px]"
            valueClassName="max-w-full text-[clamp(1.3rem,2.05vw,1.9rem)]"
          />
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Keys"
          value={stats?.active_keys ?? 0}
          detail="OpenAI-compatible local credentials"
          icon={Key}
          accent="primary"
        />
        <MetricCard
          label="Models"
          value={stats?.models_available ?? 0}
          detail="Synced Ollama inventory"
          icon={Box}
          accent="secondary"
        />
        <MetricCard
          label="Assistants"
          value={stats?.assistants_count ?? 0}
          detail="Document-grounded workspaces"
          icon={Bot}
          accent="tertiary"
        />
        <MetricCard
          label="Docs Indexed"
          value={stats?.documents_indexed ?? 0}
          detail="Files available for retrieval"
          icon={FileText}
          accent="secondary"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-6 py-5">
            <div>
              <h3 className="font-headline text-2xl font-bold tracking-[-0.04em] text-foreground">
                Recent Activity
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Latest requests across the local gateway.
              </p>
            </div>
            <DataBadge tone="neutral">Last 24 Hours</DataBadge>
          </div>

          {recentLogs.length === 0 ? (
            <EmptyState
              className="m-6 min-h-72"
              title="No traffic yet"
              description="Create an API key, run a model request, or use the playground to start generating activity."
            />
          ) : (
            <div className="overflow-x-auto px-4 py-4">
              <table className="w-full border-separate border-spacing-y-2 text-left">
                <thead>
                  <tr>
                    <TableHead>Event</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="rounded-[22px] bg-[var(--surface-muted)] transition-colors hover:bg-[var(--surface-raised)]"
                    >
                      <td className="rounded-l-[22px] px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-full",
                              log.status_code < 400
                                ? "bg-[rgba(128,120,58,0.16)] text-primary"
                                : "bg-[rgba(239,90,90,0.16)] text-destructive"
                            )}
                          >
                            <Layers3 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {friendlyEventName(log)}
                            </p>
                            <p className="font-label mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                              {log.endpoint}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {log.model_used ?? "No model"}
                      </td>
                      <td className="px-5 py-4">
                        <DataBadge tone={log.status_code < 400 ? "success" : "danger"}>
                          {log.status_code < 400 ? "Success" : "Failed"}
                        </DataBadge>
                      </td>
                      <td className="rounded-r-[22px] px-5 py-4 text-sm text-muted-foreground">
                        {formatRelativeTime(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel className="p-6">
            <h3 className="font-headline text-2xl font-bold tracking-[-0.04em] text-foreground">
              System Readiness
            </h3>
            <div className="mt-5 space-y-4">
              <ReadinessRow
                label="Backend"
                value={health ? "Ready" : "Starting"}
                percent={health ? 100 : 42}
              />
              <ReadinessRow
                label="Ollama"
                value={health?.ollama.connected ? "Connected" : "Offline"}
                percent={health?.ollama.connected ? 100 : 18}
              />
              <ReadinessRow
                label="Models"
                value={`${stats?.models_available ?? 0} synced`}
                percent={Math.min((stats?.models_available ?? 0) * 18, 100)}
              />
            </div>
          </Panel>

          <Panel className="p-6">
            <h3 className="font-headline text-2xl font-bold tracking-[-0.04em] text-foreground">
              Quick Actions
            </h3>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <QuickLink to="/models" label="Sync Models" icon={Box} />
              <QuickLink to="/playground" label="Open Playground" icon={Clock3} />
              <QuickLink to="/assistants" label="New Assistant" icon={Bot} />
              <QuickLink to="/keys" label="Issue Key" icon={Key} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[var(--border-soft)] bg-[rgba(37,31,26,0.88)] px-5 py-3.5">
      <p className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="font-headline mt-2.5 max-w-full text-[clamp(1.15rem,1.7vw,1.7rem)] font-black leading-[1.04] tracking-[-0.04em] text-foreground [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

function TableHead({ children }: { children: string }) {
  return (
    <th className="font-label px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </th>
  );
}

function QuickLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof Bot;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-[24px] bg-[var(--surface-raised)] text-center transition-all hover:bg-[var(--surface-panel-2)]"
    >
      <Icon className="h-5 w-5 text-primary" />
      <span className="font-label text-[11px] font-medium text-foreground">{label}</span>
    </Link>
  );
}

function ReadinessRow({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className="text-sm text-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(Math.min(percent, 100), 8)}%` }}
        />
      </div>
    </div>
  );
}

function friendlyEventName(log: LogSummary) {
  if (log.endpoint.includes("/chat/completions")) {
    return "Chat Inference";
  }
  if (log.endpoint.includes("documents")) {
    return "Document Task";
  }
  if (log.endpoint.includes("models")) {
    return "Model Operation";
  }
  return "Gateway Request";
}
