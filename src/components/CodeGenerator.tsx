import { useMemo, useState } from "react";
import { Check, Code2, Copy, FileCode2, Sparkles } from "lucide-react";
import type { AlgorithmId, LimiterConfig } from "../lib/limiter";
import { ALGORITHMS } from "../lib/limiter";
import { getSnippet, LANGS, type LangId } from "../lib/snippets";
import { Badge, Card, CardContent, CardHeader, CardTitle, TabStrip } from "./ui";
import { cn } from "../utils/cn";

interface Props {
  algo: AlgorithmId;
  cfg: LimiterConfig;
}

const TOKEN_RE =
  /(\/\/[^\n]*|#[^\n]*|"""[\s\S]*?"""|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d[\d_.]*\b|\b(?:const|let|var|function|return|if|else|elif|for|while|import|from|export|default|async|await|new|class|try|catch|throw|type|interface|as|of|in|not|and|or|with|def|self|None|True|False|null|true|false|lambda|pass|yield)\b)/g;

function classify(t: string): string {
  if (t.startsWith("//") || t.startsWith("#")) return "text-slate-500 italic";
  if (/^["'`]/.test(t)) return "text-emerald-300";
  if (/^\d/.test(t)) return "text-amber-300";
  return "text-indigo-300";
}

function highlightLines(code: string) {
  const toks: { text: string; cls: string }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(code)) !== null) {
    if (m.index > last) toks.push({ text: code.slice(last, m.index), cls: "text-slate-300" });
    toks.push({ text: m[0], cls: classify(m[0]) });
    last = m.index + m[0].length;
  }
  if (last < code.length) toks.push({ text: code.slice(last), cls: "text-slate-300" });

  const lines: { text: string; cls: string }[][] = [[]];
  for (const tok of toks) {
    const parts = tok.text.split("\n");
    parts.forEach((p, i) => {
      if (i > 0) lines.push([]);
      if (p) lines[lines.length - 1].push({ text: p, cls: tok.cls });
    });
  }
  return lines;
}

export function CodeGenerator({ algo, cfg }: Props) {
  const [lang, setLang] = useState<LangId>("express");
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => getSnippet(algo, lang, cfg), [algo, lang, cfg]);
  const lines = useMemo(() => highlightLines(code), [code]);
  const meta = LANGS.find((l) => l.id === lang)!;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* noop */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5 text-indigo-400" />
          Middleware Snippet Generator
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="indigo">
            <Sparkles className="h-3 w-3" />
            live-bound to sliders
          </Badge>
          <TabStrip
            size="sm"
            value={lang}
            onChange={setLang}
            tabs={LANGS.map((l) => ({ id: l.id, label: l.label }))}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
            <FileCode2 className="h-3.5 w-3.5 text-emerald-400" />
            {meta.file}
          </span>
          <span className="font-mono text-[10px] text-slate-500">{meta.sub}</span>
          <span className="font-mono text-[10px] text-slate-600">
            {ALGORITHMS[algo].label} · {lines.length} lines
          </span>
          <button
            onClick={copy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel-2/70 px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300 transition-colors hover:border-indigo-500/50 hover:text-white"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "copied" : "copy"}
          </button>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-hairline bg-[#0b1120]">
          <div className="flex items-center gap-1.5 border-b border-hairline bg-base/70 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            <span className="ml-2 font-mono text-[10px] text-slate-500">
              {meta.runtime} · generated from capacity {cfg.capacity} / {cfg.refillRate} per sec
            </span>
          </div>

          <div className="max-h-[420px] overflow-auto">
            <div className="flex min-w-max">
              <div className="select-none border-r border-hairline bg-base/40 px-3 py-3 text-right font-mono text-[10.5px] leading-[1.65] text-slate-700">
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <pre className="flex-1 px-4 py-3 font-mono text-[10.5px] leading-[1.65] sm:text-[11.5px]">
                <code>
                  {lines.map((toks, i) => (
                    <div key={i} className="whitespace-pre">
                      {toks.length ? (
                        toks.map((t, j) => (
                          <span key={j} className={cn(t.cls)}>
                            {t.text}
                          </span>
                        ))
                      ) : (
                        <span> </span>
                      )}
                    </div>
                  ))}
                </code>
              </pre>
            </div>
          </div>
        </div>

        <p className="font-mono text-[10px] leading-relaxed text-slate-600">
          Change the algorithm or drag a slider — the middleware constants, Redis keys, TTLs and header
          payloads regenerate to match this exact configuration.
        </p>
      </CardContent>
    </Card>
  );
}
