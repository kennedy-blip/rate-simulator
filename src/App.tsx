import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCheck, Keyboard, Server, ShieldCheck, X, Zap } from "lucide-react";
import { ControlPanel, AlgorithmInfo } from "./components/ControlPanel";
import { CodeGenerator } from "./components/CodeGenerator";
import { Header } from "./components/Header";
import { HeadersDrawer } from "./components/HeadersDrawer";
import { MetricsRow } from "./components/Metrics";
import { RequestStream } from "./components/RequestStream";
import { Visualizer } from "./components/Visualizer";
import { useSimulator } from "./hooks/useSimulator";
import { ALGORITHMS, fmt, type HeaderSet, type LogEntry } from "./lib/limiter";
import { exportConfig } from "./lib/snippets";

export default function App() {
  const sim = useSimulator();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inspected, setInspected] = useState<{ headers: HeaderSet; entry: LogEntry } | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const logsRef = useRef(sim.logs);
  logsRef.current = sim.logs;

  /* burst verdict toast */
  useEffect(() => {
    if (!sim.burstPulse) return;
    const show = window.setTimeout(() => {
      const denied = logsRef.current.filter((l) => l.source === "burst" && !l.allowed).length;
      setToast(
        denied
          ? { ok: false, text: `Burst wave throttled — ${denied} of 20 requests rejected with 429` }
          : { ok: true, text: "Burst wave admitted — the bucket had enough headroom" },
      );
    }, 500);
    const clear = window.setTimeout(() => setToast(null), 4600);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(clear);
    };
  }, [sim.burstPulse]);

  const headersFromEntry = useCallback(
    (e: LogEntry): HeaderSet => {
      const meta = ALGORITHMS[sim.algo];
      return {
        limit:
          meta.windowVisible
            ? `${e.capacity} / ${sim.cfg.windowSeconds}s`
            : `${e.capacity} burst / ${sim.cfg.refillRate} rps`,
        remaining: String(Math.max(0, Math.floor(e.tokensAfter))),
        reset: String(Math.max(1, Math.ceil(e.retryAfter || 0.2))),
        retryAfter: e.allowed ? "—" : String(Math.max(1, Math.ceil(e.retryAfter))),
        policy: `${e.capacity}-${meta.id};rate=${sim.cfg.refillRate}/s`,
        resetKind: meta.windowVisible ? "window expiry" : "token refill",
      };
    },
    [sim.algo, sim.cfg],
  );

  const handleInspect = useCallback(
    (entry: LogEntry) => {
      setInspected({ headers: headersFromEntry(entry), entry });
      setDrawerOpen(true);
    },
    [headersFromEntry],
  );

  const handleExport = useCallback(() => {
    const json = exportConfig(sim.algo, sim.cfg, {
      liveMetrics: {
        totalRequests: sim.metrics.total,
        throttled: sim.metrics.throttled,
        throttledRatePct: Number(sim.metrics.throttledRate.toFixed(2)),
        bucketLevelPct: Number((sim.view.level * 100).toFixed(1)),
        requestsInBuffer: sim.logs.length,
      },
      burstTest: { waveSize: sim.burstSize },
    });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ratepulse-${sim.algo}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sim.algo, sim.cfg, sim.metrics, sim.view, sim.logs.length, sim.burstSize]);

  /* keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        sim.setRunning(!sim.running);
      } else if (e.key.toLowerCase() === "b") {
        sim.sendBurst();
      } else if (e.key.toLowerCase() === "r") {
        sim.reset();
      } else if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim]);

  return (
    <div className="min-h-screen font-sans text-slate-200">
      <Header
        algo={sim.algo}
        setAlgo={sim.setAlgo}
        running={sim.running}
        setRunning={sim.setRunning}
        onReset={sim.reset}
        onExport={handleExport}
        throttledRate={sim.metrics.throttledRate}
        uptime={sim.metrics.uptime}
      />

      <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* left rail */}
          <div className="space-y-4 xl:col-span-4">
            <ControlPanel
              algo={sim.algo}
              cfg={sim.cfg}
              update={sim.update}
              running={sim.running}
              setRunning={sim.setRunning}
              sendBurst={sim.sendBurst}
              burstSize={sim.burstSize}
            />
            <AlgorithmInfo algo={sim.algo} cfg={sim.cfg} />
          </div>

          {/* main stage */}
          <div className="space-y-4 xl:col-span-8">
            <MetricsRow
              metrics={sim.metrics}
              cfg={sim.cfg}
              algo={sim.algo}
              view={sim.view}
              logs={sim.logs}
              lastDenied={sim.lastDenied}
              onOpenDrawer={() => {
                if (sim.lastDenied) handleInspect(sim.lastDenied);
                else setDrawerOpen(true);
              }}
            />
            <Visualizer
              algo={sim.algo}
              cfg={sim.cfg}
              state={sim.snapshot}
              level={sim.view.level}
              resetIn={sim.view.resetIn}
              series={sim.series}
              logs={sim.logs}
              burstPulse={sim.burstPulse}
            />
            <RequestStream logs={sim.logs} onInspect={handleInspect} />
          </div>

          {/* code generator */}
          <div className="xl:col-span-12">
            <CodeGenerator algo={sim.algo} cfg={sim.cfg} />
          </div>
        </div>

        {/* footer */}
        <footer className="mt-8 border-t border-hairline pt-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[10px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-indigo-500" />
              RatePulse · client-side throttle lab
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              {fmt.format(sim.metrics.total)} simulated requests · {sim.metrics.throttledRate.toFixed(1)}% throttled
            </span>
            <span className="flex items-center gap-2 text-slate-500">
              <Keyboard className="h-3.5 w-3.5" />
              <kbd className="rounded border border-hairline bg-white/5 px-1.5 py-0.5 text-slate-400">space</kbd>
              pause
              <kbd className="rounded border border-hairline bg-white/5 px-1.5 py-0.5 text-slate-400">b</kbd>
              burst
              <kbd className="rounded border border-hairline bg-white/5 px-1.5 py-0.5 text-slate-400">r</kbd>
              reset
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Poisson arrivals · 100 ms simulation tick
            </span>
          </div>
        </footer>
      </main>

      <HeadersDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        headers={inspected?.headers ?? sim.headers}
        entry={inspected?.entry ?? sim.logs[0] ?? null}
        algo={sim.algo}
        cfg={sim.cfg}
      />

      {toast && (
        <div
          className={`animate-fade-up fixed bottom-5 left-1/2 z-[60] flex w-[min(94vw,440px)] -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-3 backdrop-blur-xl sm:left-auto sm:right-6 sm:translate-x-0 ${
            toast.ok
              ? "border-emerald-500/40 bg-emerald-950/80 shadow-[0_18px_40px_-18px_rgba(16,185,129,0.6)]"
              : "border-rose-500/45 bg-rose-950/80 shadow-[0_18px_40px_-18px_rgba(244,63,94,0.6)]"
          }`}
        >
          {toast.ok ? (
            <CheckCheck className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          )}
          <p className="font-mono text-[11px] leading-snug text-slate-200">{toast.text}</p>
          <button
            onClick={() => setToast(null)}
            className="ml-auto rounded p-1 text-slate-500 transition-colors hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
