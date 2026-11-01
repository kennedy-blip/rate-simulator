import { Activity, Droplet, Layers, Waves } from "lucide-react";
import { fillRatio, type AlgorithmId, type LimiterConfig, type LimiterState, type LogEntry } from "../lib/limiter";
import type { Sample } from "../hooks/useSimulator";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "./ui";
import { cn } from "../utils/cn";

interface VizProps {
  algo: AlgorithmId;
  cfg: LimiterConfig;
  state: LimiterState;
  level: number;
  resetIn: number;
  series: Sample[];
  logs: LogEntry[];
  burstPulse: number;
}

function heat(level: number) {
  if (level > 0.92)
    return {
      bar: "from-rose-500 to-rose-400",
      fill: "from-rose-500/80 to-rose-400/45",
      text: "text-rose-300",
      ring: "border-rose-400/40",
    };
  if (level > 0.7)
    return {
      bar: "from-amber-500 to-amber-400",
      fill: "from-amber-500/80 to-amber-400/45",
      text: "text-amber-300",
      ring: "border-amber-400/40",
    };
  return {
    bar: "from-emerald-500 to-emerald-400",
    fill: "from-emerald-500/80 to-emerald-400/45",
    text: "text-emerald-300",
    ring: "border-emerald-400/40",
  };
}

/* ------------------------------ bucket tank ------------------------------ */

function Tank({
  level,
  pressure,
  algo,
  capacity,
  label,
  sub,
}: {
  level: number;
  pressure: number;
  algo: AlgorithmId;
  capacity: number;
  label: string;
  sub: string;
}) {
  const h = heat(pressure);
  const pct = Math.max(2, Math.min(100, level * 100));
  return (
    <div className="flex items-end gap-4">
      <div
        className={cn(
          "relative h-44 w-24 shrink-0 overflow-hidden rounded-t-xl rounded-b-md border-2 bg-base/80 grid-noise transition-colors duration-300 sm:w-28",
          h.ring,
        )}
      >
        {/* capacity ticks */}
        {[25, 50, 75].map((t) => (
          <div key={t} className="absolute left-0 right-0 border-t border-dashed border-white/8" style={{ bottom: `${t}%` }} />
        ))}
        {/* fill */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t transition-[height] duration-150 ease-out",
            algo === "leaky-bucket"
              ? "from-sky-500/70 via-indigo-500/50 to-indigo-400/40"
              : h.fill,
          )}
          style={{ height: `${pct}%` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.16),transparent_45%)]" />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-white/50 shadow-[0_0_12px_rgba(255,255,255,0.7)]" />
          {algo === "leaky-bucket" && (
            <div className="absolute inset-x-0 -top-5 flex justify-center">
              <Droplet className="h-3.5 w-3.5 animate-drip text-sky-300" />
            </div>
          )}
        </div>
        {/* measurement label */}
        <div className="absolute inset-x-0 top-2 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
          {algo === "leaky-bucket" ? "queue" : "tokens"}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <p className={cn("font-mono text-3xl font-extrabold leading-none tabular-nums", h.text)}>
          {Math.round(level * capacity)}
          <span className="text-base text-slate-600"> / {capacity}</span>
        </p>
        <p className="font-mono text-[10px] leading-snug text-slate-500">{sub}</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-150", h.bar)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* --------------------------- window based strips -------------------------- */

function WindowBlocks({ used, capacity }: { used: number; capacity: number }) {
  const total = Math.min(Math.max(capacity, 1), 100);
  const shown = Math.min(used, total);
  return (
    <div className="flex items-end gap-4">
      <div className="grid h-44 w-28 shrink-0 auto-rows-fr grid-cols-5 content-end gap-1 rounded-t-xl rounded-b-md border-2 border-hairline bg-base/80 p-2 grid-noise sm:w-32">
        {Array.from({ length: total }).map((_, i) => {
          const filled = i < shown;
          const isEdge = i === shown - 1;
          return (
            <div
              key={i}
              className={cn(
                "h-full rounded-[3px] transition-all duration-150",
                filled
                  ? isEdge
                    ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]"
                    : shown / total > 0.9
                      ? "bg-rose-500/80"
                      : "bg-emerald-500/70"
                  : "bg-white/6",
              )}
              style={{ order: total - i }}
            />
          );
        })}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">window counter</p>
        <p className="font-mono text-3xl font-extrabold leading-none tabular-nums text-slate-100">
          {used}
          <span className="text-base text-slate-600"> / {capacity}</span>
        </p>
        <p className="font-mono text-[10px] leading-snug text-slate-500">
          Counter increments per admitted request and clears entirely at rollover.
        </p>
      </div>
    </div>
  );
}

function SlidingTimeline({
  state,
  cfg,
  now,
}: {
  state: LimiterState;
  cfg: LimiterConfig;
  now: number;
}) {
  const winMs = cfg.windowSeconds * 1000;
  const hits = state.hits.filter((t) => t >= now - winMs);
  const ratio = Math.min(1, hits.length / Math.max(1, cfg.capacity));
  const h = heat(ratio);
  return (
    <div className="flex items-end gap-4">
      <div className="relative h-44 w-28 shrink-0 overflow-hidden rounded-xl border-2 border-hairline bg-base/80 p-2 grid-noise sm:w-32">
        <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-between px-0.5 py-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-px w-full bg-white/8" />
          ))}
        </div>
        <div className="relative flex h-full flex-wrap content-start gap-[3px] overflow-hidden">
          {hits.slice(-72).map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="h-2 w-2 rounded-[2px] bg-emerald-400/85 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
              style={{ opacity: 0.35 + 0.65 * Math.min(1, (t - (now - winMs)) / winMs + 0.35) }}
            />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500/10 via-amber-500/30 to-rose-500/40" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">trailing log</p>
        <p className={cn("font-mono text-3xl font-extrabold leading-none tabular-nums", h.text)}>
          {hits.length}
          <span className="text-base text-slate-600"> / {cfg.capacity}</span>
        </p>
        <p className="font-mono text-[10px] leading-snug text-slate-500">
          Timestamps expire continuously — the oldest hit leaves the window in{" "}
          <span className="text-slate-300">{hits.length ? Math.max(0, (hits[0] + winMs - now) / 1000).toFixed(1) : "0.0"}s</span>.
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div className={cn("h-full rounded-full bg-gradient-to-r transition-[width]", h.bar)} style={{ width: `${ratio * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- chart --------------------------------- */

function ThroughputChart({ series }: { series: Sample[] }) {
  const max = Math.max(6, ...series.map((s) => s.allowed + s.throttled));
  const pts = series
    .map((s, i) => `${(i / Math.max(1, series.length - 1)) * 100},${40 - s.level * 38}`)
    .join(" ");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-sm bg-emerald-400" /> 200 ok
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-sm bg-rose-500" /> 429 throttled
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <i className="h-2 w-4 rounded-full bg-indigo-400" /> tank level
          </span>
        </span>
        <span>peak {max} req/s</span>
      </div>

      <div className="relative h-40 w-full overflow-hidden rounded-lg border border-hairline bg-base/70 p-2 grid-noise">
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full p-2"
        >
          <polyline
            points={pts}
            fill="none"
            stroke="#818cf8"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            opacity={0.9}
          />
        </svg>
        <div className="relative flex h-full items-end gap-[2px]">
          {series.map((s) => {
            const totalH = ((s.allowed + s.throttled) / max) * 100;
            const denyH = s.allowed + s.throttled ? (s.throttled / (s.allowed + s.throttled)) * totalH : 0;
            return (
              <div key={s.t} className="group relative flex h-full flex-1 flex-col justify-end" style={{ maxWidth: 22 }}>
                <div
                  className="w-full rounded-t-[2px] bg-rose-500/85 shadow-[0_0_8px_rgba(244,63,94,0.35)]"
                  style={{ height: `${denyH}%` }}
                />
                <div
                  className="w-full bg-emerald-500/55 transition-[height] duration-200"
                  style={{ height: `${totalH - denyH}%`, borderRadius: denyH ? 0 : "2px 2px 0 0" }}
                />
              </div>
            );
          })}
          {!series.length && (
            <div className="grid h-full w-full place-items-center font-mono text-[11px] text-slate-600">
              awaiting traffic…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ status strip ---------------------------- */

function StatusStrip({ logs }: { logs: LogEntry[] }) {
  const recent = logs.slice(0, 60).reverse();
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
        admission trace · oldest → newest
      </p>
      <div className="flex flex-wrap gap-1">
        {recent.map((l) => (
          <span
            key={l.id}
            title={`${l.method} ${l.path} → ${l.allowed ? "200 OK" : "429"} · retry ${l.retryAfter.toFixed(2)}s`}
            className={cn(
              "h-3.5 w-3.5 rounded-[3px] transition-transform hover:scale-125",
              l.allowed
                ? l.source === "burst"
                  ? "bg-emerald-400/90"
                  : "bg-emerald-500/55"
                : "bg-rose-500 shadow-[0_0_7px_rgba(244,63,94,0.55)]",
            )}
          />
        ))}
        {!recent.length && <span className="font-mono text-[11px] text-slate-600">no requests yet</span>}
      </div>
    </div>
  );
}

/* --------------------------------- shell -------------------------------- */

export function Visualizer({ algo, cfg, state, level, resetIn, series, logs, burstPulse }: VizProps) {
  const now = Date.now();
  // For a token bucket a full tank is healthy; for every other shape a full
  // tank means the limiter is about to reject. Normalise to "pressure".
  const pressure = algo === "token-bucket" ? 1 - level : level;
  const h = heat(pressure);
  const saturated = pressure > 0.92;

  return (
    <Card glow={saturated}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Waves className="h-3.5 w-3.5 text-indigo-400" />
          Live Throttle State
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge tone={saturated ? "danger" : pressure > 0.7 ? "amber" : "success"} dot>
            {saturated ? "Rejecting" : pressure > 0.7 ? "Pressure" : "Healthy"}
          </Badge>
          <Badge tone="neutral">
            reset in {resetIn > 0 ? `${resetIn.toFixed(1)}s` : "ready"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div key={burstPulse} className="animate-fade">
          {algo === "token-bucket" && (
            <Tank
              level={state.tokens / Math.max(1, cfg.capacity)}
              pressure={pressure}
              algo={algo}
              capacity={cfg.capacity}
              label="token bucket"
              sub={`Refilling ${cfg.refillRate} tokens/sec · ${Math.max(0, cfg.capacity - state.tokens).toFixed(1)} tokens to full`}
            />
          )}
          {algo === "leaky-bucket" && (
            <Tank
              level={state.water / Math.max(1, cfg.capacity)}
              pressure={pressure}
              algo={algo}
              capacity={cfg.capacity}
              label="leaky bucket queue"
              sub={`Draining ${cfg.refillRate} req/sec · overflow above ${cfg.capacity} rejects instantly`}
            />
          )}
          {algo === "fixed-window" && <WindowBlocks used={state.windowCount} capacity={cfg.capacity} />}
          {algo === "sliding-window" && <SlidingTimeline state={state} cfg={cfg} now={now} />}
        </div>

        <ThroughputChart series={series} />
        <StatusStrip logs={logs} />

        <div className="grid grid-cols-2 gap-3 border-t border-hairline pt-4 sm:grid-cols-4">
          {[
            { k: "algorithm", v: algo.replace("-", " ") },
            { k: "fill ratio", v: `${(fillRatio(state, cfg, algo) * 100).toFixed(0)}%` },
            { k: "sustained cap", v: `${cfg.refillRate}/s` },
            { k: "state", v: saturated ? "throttling" : "admitting", cls: h.text },
          ].map((x) => (
            <div key={x.k}>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">{x.k}</p>
              <p className={cn("font-mono text-xs font-semibold capitalize text-slate-200", x.cls)}>{x.v}</p>
            </div>
          ))}
        </div>

        <p className="flex items-center gap-2 font-mono text-[10px] text-slate-600">
          <Layers className="h-3 w-3" /> All state is in-memory & single-key — scale-out needs a shared store (Redis).
          <Activity className="ml-auto h-3 w-3" />
        </p>
      </CardContent>
    </Card>
  );
}
