import { useMemo, useState } from "react";
import { CircleSlash, MousePointerClick, RadioTower, ShieldCheck, Terminal } from "lucide-react";
import type { LogEntry } from "../lib/limiter";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "./ui";
import { cn } from "../utils/cn";

type Filter = "all" | "ok" | "throttled";

interface Props {
  logs: LogEntry[];
  onInspect: (entry: LogEntry) => void;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ok", label: "200" },
  { id: "throttled", label: "429" },
];

export function RequestStream({ logs, onInspect }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [pinned, setPinned] = useState<LogEntry | null>(null);

  const shown = useMemo(() => {
    const base = filter === "all" ? logs : logs.filter((l) => (filter === "ok" ? l.allowed : !l.allowed));
    return base.slice(0, 40);
  }, [logs, filter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-indigo-400" />
          Request Stream
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-hairline bg-base/70 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-md px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors",
                  filter === f.id
                    ? f.id === "throttled"
                      ? "bg-rose-500/20 text-rose-200"
                      : f.id === "ok"
                        ? "bg-emerald-500/20 text-emerald-200"
                        : "bg-indigo-500/20 text-indigo-200"
                    : "text-slate-500 hover:text-slate-200",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Badge tone="neutral">
            <RadioTower className="h-3 w-3" />
            {logs.length}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="max-h-[340px] min-h-[220px] overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
              <tr className="border-b border-hairline font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">
                <th className="px-3 py-2 font-semibold">status</th>
                <th className="px-3 py-2 font-semibold">method · path</th>
                <th className="hidden px-3 py-2 font-semibold sm:table-cell">client</th>
                <th className="hidden px-3 py-2 text-right font-semibold md:table-cell">quota left</th>
                <th className="hidden px-3 py-2 text-right font-semibold md:table-cell">latency</th>
                <th className="px-3 py-2 text-right font-semibold">retry</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => {
                    setPinned(l);
                    onInspect(l);
                  }}
                  className={cn(
                    "animate-fade-up cursor-pointer border-b border-hairline/60 transition-colors hover:bg-white/[0.04]",
                    pinned?.id === l.id && "bg-indigo-500/8",
                  )}
                >
                  <td className="px-3 py-2">
                    {l.allowed ? (
                      <Badge tone="success">200 OK</Badge>
                    ) : (
                      <Badge tone="danger">429</Badge>
                    )}
                  </td>
                  <td className="max-w-[190px] px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded px-1 py-px font-mono text-[9px] font-bold",
                          l.method === "GET"
                            ? "bg-sky-500/15 text-sky-300"
                            : l.method === "POST"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-violet-500/15 text-violet-300",
                        )}
                      >
                        {l.method}
                      </span>
                      <span className="truncate font-mono text-[11px] text-slate-300">{l.path}</span>
                      {l.source === "burst" && (
                        <span className="shrink-0 font-mono text-[9px] text-amber-400/90" title="burst wave">
                          ⚡
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-[10px] text-slate-500 sm:table-cell">{l.ip}</td>
                  <td className="hidden px-3 py-2 text-right font-mono text-[10px] tabular-nums text-slate-400 md:table-cell">
                    {l.tokensAfter}/{l.capacity}
                  </td>
                  <td className="hidden px-3 py-2 text-right font-mono text-[10px] tabular-nums text-slate-400 md:table-cell">
                    {l.latencyMs}ms
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[10px] tabular-nums">
                    {l.allowed ? (
                      <span className="text-slate-600">—</span>
                    ) : (
                      <span className="text-rose-300">{Math.max(1, Math.ceil(l.retryAfter))}s</span>
                    )}
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <p className="flex flex-col items-center gap-2 font-mono text-[11px] text-slate-600">
                      <CircleSlash className="h-4 w-4" />
                      no matching requests in the buffer
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 border-t border-hairline px-4 py-2 font-mono text-[10px] text-slate-600">
          <MousePointerClick className="h-3 w-3" />
          click a row to inspect its 429 / 200 response headers
          {pinned && (
            <span className="ml-auto flex items-center gap-1.5 text-slate-500">
              <ShieldCheck className="h-3 w-3 text-indigo-400" />
              pinned #{pinned.seq}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
