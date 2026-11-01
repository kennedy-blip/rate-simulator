import {
  Check,
  CircleGauge,
  Cpu,
  Droplets,
  Info,
  Minus,
  Pause,
  Play,
  Radio,
  Settings2,
  Timer,
  X,
  Zap,
} from "lucide-react";
import { ALGORITHMS, type AlgorithmId, type LimiterConfig } from "../lib/limiter";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Slider } from "./ui";
import { cn } from "../utils/cn";

interface ControlProps {
  algo: AlgorithmId;
  cfg: LimiterConfig;
  update: <K extends keyof LimiterConfig>(k: K, v: LimiterConfig[K]) => void;
  running: boolean;
  setRunning: (v: boolean) => void;
  sendBurst: () => void;
  burstSize: number;
}

const PRESETS: { name: string; hint: string; cfg: LimiterConfig }[] = [
  { name: "Balanced", hint: "default lab profile", cfg: { capacity: 24, refillRate: 15, requestRate: 19, windowSeconds: 10 } },
  { name: "Strict", hint: "tight public quota", cfg: { capacity: 5, refillRate: 2, requestRate: 18, windowSeconds: 5 } },
  { name: "Bursty", hint: "mobile app spikes", cfg: { capacity: 60, refillRate: 6, requestRate: 48, windowSeconds: 12 } },
  { name: "Flood", hint: "abuse / DDoS drill", cfg: { capacity: 10, refillRate: 3, requestRate: 120, windowSeconds: 6 } },
];

export function ControlPanel({ algo, cfg, update, running, setRunning, sendBurst, burstSize }: ControlProps) {
  const meta = ALGORITHMS[algo];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-3.5 w-3.5 text-indigo-400" />
          Throttle Controls
        </CardTitle>
        <Badge tone="indigo">{meta.label}</Badge>
      </CardHeader>

      <CardContent className="space-y-5">
        <Slider
          label={meta.capacityLabel}
          icon={CircleGauge}
          value={cfg.capacity}
          min={1}
          max={100}
          onChange={(v) => update("capacity", v)}
          hint={
            algo === "fixed-window" || algo === "sliding-window"
              ? `Hard ceiling per ${cfg.windowSeconds}s window`
              : `Maximum tokens / queue slots held at once`
          }
        />
        <Slider
          label={meta.refillLabel}
          icon={algo === "leaky-bucket" ? Droplets : Zap}
          value={cfg.refillRate}
          min={0.5}
          max={50}
          step={0.5}
          onChange={(v) => update("refillRate", v)}
          accent="emerald"
          hint={
            algo === "fixed-window"
              ? "Quota restores in one jump at rollover"
              : algo === "sliding-window"
                ? "Capacity returns hit-by-hit as timestamps expire"
                : `Sustained throughput ceiling: ${cfg.refillRate} req/s`
          }
        />
        <Slider
          label="Request Frequency"
          icon={Radio}
          value={cfg.requestRate}
          min={1}
          max={200}
          onChange={(v) => update("requestRate", v)}
          accent="rose"
          hint={`Poisson arrivals ≈ ${cfg.requestRate} req/s against ${cfg.refillRate} req/s service rate`}
        />
        {meta.windowVisible && (
          <Slider
            label="Window Length"
            icon={Timer}
            value={cfg.windowSeconds}
            min={1}
            max={60}
            onChange={(v) => update("windowSeconds", v)}
            hint={`Rolling interval = ${cfg.windowSeconds}s · reset cost = ${cfg.windowSeconds}s max wait`}
          />
        )}

        <div className="space-y-2 rounded-lg border border-hairline bg-base/60 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Load Presets</p>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => {
              const active =
                p.cfg.capacity === cfg.capacity &&
                p.cfg.refillRate === cfg.refillRate &&
                p.cfg.requestRate === cfg.requestRate &&
                p.cfg.windowSeconds === cfg.windowSeconds;
              return (
                <button
                  key={p.name}
                  onClick={() => {
                    (Object.keys(p.cfg) as (keyof LimiterConfig)[]).forEach((k) => update(k, p.cfg[k]));
                  }}
                  className={cn(
                    "group rounded-lg border px-2.5 py-2 text-left transition-all",
                    active
                      ? "border-indigo-400/50 bg-indigo-500/12"
                      : "border-hairline bg-panel-2/50 hover:border-indigo-500/40 hover:bg-indigo-500/8",
                  )}
                >
                  <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-slate-200">
                    {active ? <Check className="h-3 w-3 text-indigo-300" /> : <Minus className="h-3 w-3 text-slate-600" />}
                    {p.name}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[9px] text-slate-500">{p.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          <Button variant="danger" className="flex-1" onClick={sendBurst}>
            <Zap className="h-4 w-4" />
            Send Burst Traffic ({burstSize})
          </Button>
          <Button variant="outline" onClick={() => setRunning(!running)} className="sm:w-32">
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Stop" : "Start"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AlgorithmInfo({ algo, cfg }: { algo: AlgorithmId; cfg: LimiterConfig }) {
  const meta = ALGORITHMS[algo];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-indigo-400" />
          {meta.label}
        </CardTitle>
        <Badge tone="neutral">
          <Cpu className="h-3 w-3" />
          {meta.memory}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="font-mono text-[11px] leading-relaxed text-slate-400">
          {meta.essence.split("`").map((chunk, i) =>
            i % 2 === 1 ? (
              <code key={i} className="rounded bg-indigo-500/12 px-1 py-px text-indigo-300">
                {chunk}
              </code>
            ) : (
              <span key={i}>{chunk}</span>
            ),
          )}
        </p>

        <div className="rounded-lg border border-hairline bg-base/60 p-3 font-mono text-[10px] leading-relaxed text-slate-400">
          <span className="text-slate-500">burst behaviour → </span>
          {meta.burst}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ul className="space-y-1.5">
            <li className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-400/80">strengths</li>
            {meta.pros.map((p) => (
              <li key={p} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                {p}
              </li>
            ))}
          </ul>
          <ul className="space-y-1.5">
            <li className="font-mono text-[9px] uppercase tracking-[0.18em] text-rose-400/80">trade-offs</li>
            {meta.cons.map((p) => (
              <li key={p} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-400">
                <X className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-hairline pt-3 font-mono text-[10px] text-slate-500">
          <div>
            <span className="block text-slate-600">capacity</span>
            <span className="text-indigo-300">{cfg.capacity}</span>
          </div>
          <div>
            <span className="block text-slate-600">service rate</span>
            <span className="text-emerald-300">{cfg.refillRate}/s</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
