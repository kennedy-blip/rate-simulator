import { Activity, Braces, Gauge, Pause, Play, RotateCcw, ShieldAlert } from "lucide-react";
import { ALGORITHMS, ALGO_ORDER, fmt, type AlgorithmId } from "../lib/limiter";
import { Badge, Button, TabStrip } from "./ui";
import { cn } from "../utils/cn";

interface HeaderProps {
  algo: AlgorithmId;
  setAlgo: (a: AlgorithmId) => void;
  running: boolean;
  setRunning: (v: boolean) => void;
  onReset: () => void;
  onExport: () => void;
  throttledRate: number;
  uptime: number;
}

export function Header({
  algo,
  setAlgo,
  running,
  setRunning,
  onReset,
  onExport,
  throttledRate,
  uptime,
}: HeaderProps) {
  const meta = ALGORITHMS[algo];
  const healthy = throttledRate < 25;

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-base/85 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {/* brand */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-indigo-400/40 bg-gradient-to-br from-indigo-500/30 to-indigo-950/60 shadow-[0_0_28px_-6px_rgba(99,102,241,0.85)]">
              <Gauge className="h-5.5 w-5.5 text-indigo-200 drop-shadow-[0_0_10px_rgba(129,140,248,0.9)]" />
              <span className="absolute -inset-px rounded-xl bg-indigo-400/10 blur-[6px]" />
            </div>
            <div className="min-w-0">
              <h1 className="font-mono text-lg font-extrabold leading-none tracking-tight text-white sm:text-xl">
                Rate<span className="text-glow-indigo text-indigo-400">Pulse</span>
              </h1>
              <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Rate limiting · Throttling · Token bucket lab
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Badge tone={healthy ? "success" : "danger"} className="hidden sm:inline-flex" dot>
              <span className="hidden md:inline">Throttle Engine:</span>
              {running ? (healthy ? "Active" : "Saturated") : "Paused"}
            </Badge>
            <Badge tone="indigo" className="hidden lg:inline-flex">
              <Activity className="h-3 w-3" />
              {fmt.format(Math.round(uptime))}s uptime
            </Badge>
            <Badge tone={throttledRate >= 15 ? "danger" : throttledRate > 4 ? "amber" : "neutral"}>
              <ShieldAlert className="h-3 w-3" />
              429 {throttledRate.toFixed(1)}%
            </Badge>

            <Button size="sm" variant="ghost" onClick={() => setRunning(!running)} title="Pause / resume traffic">
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{running ? "Pause" : "Resume"}</span>
            </Button>
            <Button size="sm" variant="subtle" onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset Traffic State</span>
            </Button>
            <Button size="sm" variant="primary" onClick={onExport}>
              <Braces className="h-3.5 w-3.5" />
              Export Config JSON
            </Button>
          </div>
        </div>

        {/* algorithm tabs */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <TabStrip
            value={algo}
            onChange={setAlgo}
            tabs={ALGO_ORDER.map((id) => ({
              id,
              label: ALGORITHMS[id].tab,
            }))}
          />
          <p
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500",
              "hidden xl:block",
            )}
          >
            <span className="text-slate-300">{meta.label}</span> — {meta.tagline}
          </p>
        </div>
      </div>
    </header>
  );
}
