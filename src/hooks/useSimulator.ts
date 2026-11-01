import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  acquire,
  advance,
  buildHeaders,
  createState,
  DEFAULT_CONFIG,
  fillRatio,
  poisson,
  randomRequest,
  remainingQuota,
  secondsToReset,
  type AlgorithmId,
  type HeaderSet,
  type LimiterConfig,
  type LimiterState,
  type LogEntry,
} from "../lib/limiter";

const TICK = 100;
const MAX_LOGS = 90;
const MAX_SERIES = 52;
const BURST_SIZE = 20;

export interface Sample {
  t: number;
  allowed: number;
  throttled: number;
  level: number;
}

export interface Metrics {
  total: number;
  allowed: number;
  throttled: number;
  throttledRate: number;
  uptime: number;
  peakRps: number;
}

const EMPTY_METRICS: Metrics = {
  total: 0,
  allowed: 0,
  throttled: 0,
  throttledRate: 0,
  uptime: 0,
  peakRps: 0,
};

export function useSimulator() {
  const [algo, setAlgo] = useState<AlgorithmId>("token-bucket");
  const [cfg, setCfg] = useState<LimiterConfig>(DEFAULT_CONFIG);
  const [running, setRunning] = useState(true);

  const [snapshot, setSnapshot] = useState<LimiterState>(() => createState(DEFAULT_CONFIG, "token-bucket", Date.now()));
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [series, setSeries] = useState<Sample[]>([]);
  const [headers, setHeaders] = useState<HeaderSet | null>(null);
  const [lastDenied, setLastDenied] = useState<LogEntry | null>(null);
  const [burstPulse, setBurstPulse] = useState(0);

  const stateRef = useRef<LimiterState>(snapshot);
  const burstRef = useRef(0);
  const idRef = useRef(0);
  const seqRef = useRef(0);
  const windowRef = useRef({ allowed: 0, throttled: 0, started: Date.now() });
  const cfgRef = useRef(cfg);
  const algoRef = useRef(algo);

  cfgRef.current = cfg;
  algoRef.current = algo;

  /* --- re-seed the bucket whenever parameters change ------------------- */
  useEffect(() => {
    const now = Date.now();
    const c = cfgRef.current;
    const fresh = createState(c, algo, now);
    stateRef.current = fresh;
    setSnapshot(fresh);
    setHeaders(buildHeaders(fresh, c, algo, now, false));
    burstRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algo, cfg.capacity, cfg.refillRate, cfg.windowSeconds]);

  /* --- main simulation loop ------------------------------------------- */
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const c = cfgRef.current;
      const a = algoRef.current;
      const now = Date.now();
      let st = advance(stateRef.current, c, a, now);

      let arrivals = poisson((c.requestRate * TICK) / 1000);
      let fromBurst = 0;
      if (burstRef.current > 0) {
        fromBurst = Math.min(burstRef.current, 6);
        burstRef.current -= fromBurst;
        arrivals += fromBurst;
      }
      arrivals = Math.min(arrivals, 40);

      const created: LogEntry[] = [];
      let allowedCount = 0;
      let throttledCount = 0;
      let throttledEntry: LogEntry | null = null;

      for (let i = 0; i < arrivals; i++) {
        const res = acquire(st, c, a, now + i * 4);
        st = res.state;
        const meta = randomRequest();
        seqRef.current += 1;
        const entry: LogEntry = {
          id: ++idRef.current,
          seq: seqRef.current,
          wall: now + i * 4,
          allowed: res.allowed,
          method: meta.method,
          path: meta.path,
          ip: meta.ip,
          latencyMs: res.allowed
            ? Math.round(6 + Math.random() * 38 + (a === "leaky-bucket" ? st.water * 2 : 0))
            : Math.round(1 + Math.random() * 4),
          tokensAfter: res.tokensAfter,
          capacity: c.capacity,
          retryAfter: res.retryAfter,
          source: i >= arrivals - fromBurst ? "burst" : "steady",
        };
        if (res.allowed) allowedCount += 1;
        else {
          throttledCount += 1;
          throttledEntry = entry;
        }
        created.push(entry);
      }

      stateRef.current = st;
      windowRef.current.allowed += allowedCount;
      windowRef.current.throttled += throttledCount;

      const w = windowRef.current;
      const span = (now - w.started) / 1000;
      const total = w.allowed + w.throttled;

      if (created.length) {
        const last = created[created.length - 1];
        setHeaders(buildHeaders(st, c, a, now, !last.allowed));
      }

      setLogs((prev) => {
        const merged = created.length ? [...created.reverse(), ...prev] : prev;
        return merged.slice(0, MAX_LOGS);
      });

      if (throttledEntry) setLastDenied(throttledEntry);
      setSnapshot(st);
      setMetrics({
        total,
        allowed: w.allowed,
        throttled: w.throttled,
        throttledRate: total ? (w.throttled / total) * 100 : 0,
        uptime: span,
        peakRps: 0,
      });

      const acc = Math.round(span);
      setSeries((prev) => {
        const lastT = prev.length ? prev[prev.length - 1].t : -1;
        if (acc === lastT) {
          const copy = prev.slice();
          const tail = copy[copy.length - 1];
          copy[copy.length - 1] = {
            ...tail,
            allowed: tail.allowed + allowedCount,
            throttled: tail.throttled + throttledCount,
            level: fillRatio(st, c, a),
          };
          return copy;
        }
        const next = [
          ...prev,
          { t: acc, allowed: allowedCount, throttled: throttledCount, level: fillRatio(st, c, a) },
        ];
        return next.slice(-MAX_SERIES);
      });
    }, TICK);
    return () => window.clearInterval(timer);
  }, [running]);

  /* --- actions --------------------------------------------------------- */
  const update = useCallback(<K extends keyof LimiterConfig>(key: K, value: LimiterConfig[K]) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }, []);

  const sendBurst = useCallback(() => {
    burstRef.current = BURST_SIZE;
    setBurstPulse((p) => p + 1);
  }, []);

  const reset = useCallback(() => {
    const now = Date.now();
    const fresh = createState(cfgRef.current, algoRef.current, now);
    stateRef.current = fresh;
    burstRef.current = 0;
    windowRef.current = { allowed: 0, throttled: 0, started: now };
    idRef.current = 0;
    seqRef.current = 0;
    setSnapshot(fresh);
    setLogs([]);
    setMetrics(EMPTY_METRICS);
    setSeries([]);
    setLastDenied(null);
    setHeaders(buildHeaders(fresh, cfgRef.current, algoRef.current, now, false));
  }, []);

  const view = useMemo(() => {
    const now = Date.now();
    return {
      level: fillRatio(snapshot, cfg, algo),
      used: Math.round(
        algo === "token-bucket"
          ? snapshot.tokens
          : algo === "leaky-bucket"
            ? snapshot.water
            : algo === "fixed-window"
              ? snapshot.windowCount
              : snapshot.hits.length,
      ),
      remaining: remainingQuota(snapshot, cfg, algo),
      resetIn: secondsToReset(snapshot, cfg, algo, now),
    };
  }, [snapshot, cfg, algo]);

  return {
    algo,
    setAlgo,
    cfg,
    update,
    setCfg,
    running,
    setRunning,
    logs,
    metrics,
    series,
    headers,
    lastDenied,
    snapshot,
    view,
    sendBurst,
    reset,
    burstPulse,
    burstSize: BURST_SIZE,
  };
}
