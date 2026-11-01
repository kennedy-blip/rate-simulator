import { useState } from "react";
import { Braces, Check, Copy, FileJson2, Info, X } from "lucide-react";
import type { AlgorithmId, HeaderSet, LimiterConfig, LogEntry } from "../lib/limiter";
import { ALGORITHMS } from "../lib/limiter";
import { Badge, Button, KeyVal, Separator } from "./ui";
import { cn } from "../utils/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  headers: HeaderSet | null;
  entry: LogEntry | null;
  algo: AlgorithmId;
  cfg: LimiterConfig;
}

const DOCS: Record<string, string> = {
  "X-RateLimit-Limit": "Maximum requests permitted in the current quota period for this key.",
  "X-RateLimit-Remaining": "Requests left before the limiter starts rejecting traffic.",
  "X-RateLimit-Reset": "Seconds until the quota is replenished or the window rolls over.",
  "Retry-After": "HTTP/1.1 defined hint (RFC 7231 §7.1.3) — client should back off this long.",
  "X-RateLimit-Policy": "Non-standard: names the algorithm and capacity that produced the decision.",
  "RateLimit-Policy": "IETF draft-ietf-httpapi-ratelimit-headers policy exposition.",
};

export function HeadersDrawer({ open, onClose, headers, entry, algo, cfg }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const allowed = entry ? entry.allowed : true;
  const h: HeaderSet =
    headers ??
    ({
      limit: `${cfg.capacity} burst / ${cfg.refillRate} rps`,
      remaining: String(cfg.capacity),
      reset: "0",
      retryAfter: "—",
      policy: `${algo}; capacity=${cfg.capacity}`,
      resetKind: "token refill",
    } as HeaderSet);

  const rows: [string, string][] = [
    ["X-RateLimit-Limit", h.limit],
    ["X-RateLimit-Remaining", h.remaining],
    ["X-RateLimit-Reset", `${h.reset}s (${h.resetKind})`],
    ["Retry-After", h.retryAfter],
    ["X-RateLimit-Policy", h.policy],
    [
      "RateLimit-Policy",
      `${ALGORITHMS[algo].id};q=${cfg.capacity};window=${ALGORITHMS[algo].windowVisible ? cfg.windowSeconds : "n/a"}`,
    ],
  ];

  const raw = [
    `HTTP/1.1 ${allowed ? "200 OK" : "429 Too Many Requests"}`,
    ...rows.map(([k, v]) => `${k}: ${v}`),
    `Content-Type: application/json`,
    ``,
    allowed
      ? `{"data":[…],"meta":{"quotaRemaining":${h.remaining}}}`
      : `{"error":"rate_limit_exceeded","retryAfter":${h.retryAfter.replace("s", "")},"algorithm":"${ALGORITHMS[algo].id}"}`,
  ].join("\n");

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const curl = `curl -i -X ${entry?.method ?? "GET"} https://api.ratepulse.dev${entry?.path ?? "/v1/users"} \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -H "X-Forwarded-For: ${entry?.ip ?? "10.0.0.1"}"`;

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col border-l border-hairline bg-panel shadow-[-24px_0_60px_-20px_rgba(0,0,0,0.9)] transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              <Braces className="h-3.5 w-3.5 text-indigo-400" />
              Response Headers Inspector
            </p>
            <p className="mt-1 font-mono text-[10px] text-slate-500">
              {ALGORITHMS[algo].label} · capacity {cfg.capacity}
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close inspector">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            {allowed ? (
              <Badge tone="success" dot>
                200 OK
              </Badge>
            ) : (
              <Badge tone="danger" dot>
                429 Too Many Requests
              </Badge>
            )}
            {entry && (
              <>
                <Badge tone="neutral">
                  {entry.method} {entry.path}
                </Badge>
                <Badge tone="indigo">#{entry.seq}</Badge>
                <Badge tone="neutral">{entry.latencyMs}ms</Badge>
              </>
            )}
          </div>

          <div className="space-y-1">
            {rows.map(([k, v]) => (
              <div
                key={k}
                className="group flex items-start justify-between gap-3 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-hairline hover:bg-white/[0.03]"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-indigo-300">{k}</p>
                  <p className="mt-0.5 font-mono text-[10px] leading-snug text-slate-500">{DOCS[k]}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <code
                    className={cn(
                      "max-w-[150px] truncate rounded border px-2 py-1 font-mono text-[10px]",
                      k === "Retry-After" && !allowed
                        ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                        : "border-hairline bg-base/70 text-emerald-300",
                    )}
                  >
                    {v}
                  </code>
                  <button
                    onClick={() => copy(`${k}: ${v}`, k)}
                    className="rounded p-1 text-slate-600 opacity-0 transition-opacity hover:text-slate-200 group-hover:opacity-100"
                    aria-label={`Copy ${k}`}
                  >
                    {copied === k ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <FileJson2 className="h-3.5 w-3.5 text-indigo-400" />
              raw http exchange
            </p>
            <pre className="overflow-x-auto rounded-lg border border-hairline bg-base/80 p-3 font-mono text-[10.5px] leading-relaxed text-slate-300">
              {raw}
            </pre>
            <Button size="xs" variant="subtle" onClick={() => copy(raw, "raw")}>
              {copied === "raw" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              Copy raw response
            </Button>
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <Info className="h-3.5 w-3.5 text-indigo-400" />
              reproduce it
            </p>
            <pre className="overflow-x-auto rounded-lg border border-hairline bg-base/80 p-3 font-mono text-[10.5px] leading-relaxed text-emerald-300">
              {curl}
            </pre>
            <Button size="xs" variant="subtle" onClick={() => copy(curl, "curl")}>
              {copied === "curl" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              Copy cURL
            </Button>
          </div>

          <div className="rounded-lg border border-hairline bg-base/60 p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">decision breakdown</p>
            <KeyVal k="key" v={entry?.ip ?? "10.0.0.1"} />
            <KeyVal k="algorithm" v={ALGORITHMS[algo].label} />
            <KeyVal k="quota consumed" v={`${Math.max(0, entry?.capacity ? entry.capacity - entry.tokensAfter : cfg.capacity)} / ${cfg.capacity}`} />
            <KeyVal k="verdict" v={allowed ? "admit → upstream" : "reject → 429"} />
            <KeyVal k="backoff hint" v={allowed ? "n/a" : `${Math.max(1, Math.ceil(entry?.retryAfter ?? 1))}s`} />
          </div>
        </div>
      </aside>
    </>
  );
}
