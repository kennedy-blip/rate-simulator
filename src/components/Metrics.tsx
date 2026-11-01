import { ArrowUpRight, Braces, CheckCircle2, Gauge, Inbox, ShieldX, TimerReset } from "lucide-react";
import type { AlgorithmId, LimiterConfig, LogEntry } from "../lib/limiter";
import { fmt } from "../lib/limiter";
import type { Metrics } from "../hooks/useSimulator";
import { Badge, Button, Card, CardContent } from "./ui";
import { cn } from "../utils/cn";

interface Props {
  metrics: Metrics;
  cfg: LimiterConfig;
  algo: AlgorithmId;
  view: { level: number; used: number; remaining: number; resetIn: number };
  logs: LogEntry[];
  lastDenied: LogEntry | null;
  onOpenDrawer: () => void;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  progress,
  children,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  tone: "indigo" | "rose" | "emerald" | "slate";
  progress?: number;
  children?: React.ReactNode;
}) {
  const toneCls = {
    indigo: "text-indigo-300 border-indigo-500/25 hover:border-indigo-500/45",
    rose: "text-rose-300 border-rose-500/25 hover:border-rose-500/45",
    emerald: "text-emerald-300 border-emerald-500/25 hover:border-emerald-500/45",
    slate: "text-slate-200 border-hairline hover:border-slate-500/45",
  }[tone];
  const barCls = {
    indigo: "bg-indigo-400",
    rose: "bg-rose-500",
    emerald: "bg-emerald-400",
    slate: "bg-slate-400",
  }[tone];

  return (
    <Card className={cn("group transition-colors duration-200", toneCls)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </span>
          <Icon className="h-4 w-4 opacity-70 transition-transform group-hover:scale-110" />
        </div>
        <p className={cn("font-mono text-[26px] font-extrabold leading-none tracking-tight tabular-nums", toneCls.split(" ")[0])}>
          {value}
        </p>
        {progress !== undefined && (
          <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
            <div
              className={cn("h-full rounded-full transition-[width] duration-300", barCls)}
              style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
            />
          </div>
        )}
        {children}
        <p className="font-mono text-[10px] leading-snug text-slate-500">{sub}</p>
      </CardContent>
    </Card>
  );
}

export function MetricsRow({ metrics, cfg, algo, view, logs, lastDenied, onOpenDrawer }: Props) {
  const allowedLogs = logs.filter((l) => l.allowed);
  const avgLatency = allowedLogs.length
    ? Math.round(allowedLogs.reduce((a, l) => a + l.latencyMs, 0) / allowedLogs.length)
    : 0;
  const elapsed = Math.max(0.5, metrics.uptime);
  const avgRps = metrics.total / elapsed;
  const last = logs[0];
  const tokenLabel =
    algo === "token-bucket"
      ? `${Math.floor(view.used)} / ${cfg.capacity}`
      : algo === "leaky-bucket"
        ? `${view.used} / ${cfg.capacity}`
        : `${view.remaining} left`;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={Inbox}
        tone="indigo"
        label="Total Requests Handled"
        value={fmt.format(metrics.total)}
        sub={`${avgRps.toFixed(1)} req/s avg · ${fmt.format(metrics.allowed)} passed · uptime ${Math.round(elapsed)}s`}
        progress={Math.min(100, (metrics.total / Math.max(1, metrics.total + 400)) * 100)}
      />

      <MetricCard
        icon={ShieldX}
        tone="rose"
        label="Throttled Rate (429)"
        value={`${metrics.throttledRate.toFixed(1)}%`}
        sub={`${fmt.format(metrics.throttled)} rejected · ${
          metrics.throttledRate > 20 ? "severely over limit" : metrics.throttledRate > 4 ? "over limit" : "within budget"
        }`}
        progress={metrics.throttledRate}
      />

      <MetricCard
        icon={Gauge}
        tone="emerald"
        label={algo === "leaky-bucket" ? "Bucket Occupancy" : "Current Bucket Tokens"}
        value={tokenLabel}
        sub={`capacity ${cfg.capacity} · ${
          algo === "token-bucket"
            ? `+${cfg.refillRate} tokens/s`
            : algo === "leaky-bucket"
              ? `-${cfg.refillRate}/s drain`
              : `resets in ${view.resetIn.toFixed(1)}s`
        }`}
        progress={view.level * 100}
      >
        <div className="flex gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i < Math.round(view.level * 10) ? "bg-emerald-400" : "bg-white/8",
              )}
            />
          ))}
        </div>
      </MetricCard>

      <Card className="border-indigo-500/25 transition-colors hover:border-indigo-500/50">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Last Response
            </span>
            <Braces className="h-4 w-4 text-slate-400" />
          </div>

          <div className="flex items-center gap-2">
            {last ? (
              last.allowed ? (
                <Badge tone="success" dot>
                  200 OK
                </Badge>
              ) : (
                <Badge tone="danger" dot>
                  429 Too Many Requests
                </Badge>
              )
            ) : (
              <Badge tone="neutral">idle</Badge>
            )}
            <span className="font-mono text-[10px] text-slate-500">
              {last ? `${last.latencyMs}ms · ${last.method}` : "—"}
            </span>
          </div>

          <div className="space-y-1 font-mono text-[10px] text-slate-500">
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              avg 200 latency <span className="text-slate-300">{avgLatency}ms</span>
            </p>
            <p className="flex items-center gap-1.5">
              <TimerReset className="h-3 w-3 text-rose-400" />
              retry-after{" "}
              <span className="text-slate-300">
                {lastDenied ? `${Math.max(1, Math.ceil(lastDenied.retryAfter))}s` : "—"}
              </span>
            </p>
          </div>

          <Button size="xs" variant="subtle" className="w-full justify-between" onClick={onOpenDrawer}>
            Inspect headers
            <ArrowUpRight className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
