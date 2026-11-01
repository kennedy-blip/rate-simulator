/* ------------------------------------------------------------------
 * RatePulse — rate limiting algorithm engine
 * Pure functions so the simulation can run inside a fixed-step loop.
 * ----------------------------------------------------------------- */

export type AlgorithmId =
  | "token-bucket"
  | "leaky-bucket"
  | "fixed-window"
  | "sliding-window";

export interface LimiterConfig {
  /** Burst capacity — bucket size / window limit */
  capacity: number;
  /** Refill rate (tokens or drained requests per second) */
  refillRate: number;
  /** Incoming traffic intensity, requests per second */
  requestRate: number;
  /** Window length for the window based algorithms */
  windowSeconds: number;
}

export interface LimiterState {
  tokens: number;
  water: number;
  windowStart: number;
  windowCount: number;
  hits: number[];
  lastTick: number;
}

export interface LogEntry {
  id: number;
  seq: number;
  wall: number;
  allowed: boolean;
  method: string;
  path: string;
  ip: string;
  latencyMs: number;
  tokensAfter: number;
  capacity: number;
  retryAfter: number;
  source: "steady" | "burst";
}

export interface HeaderSet {
  limit: string;
  remaining: string;
  reset: string;
  retryAfter: string;
  policy: string;
  resetKind: string;
}

export const EMPTY_STATE: LimiterState = {
  tokens: 0,
  water: 0,
  windowStart: 0,
  windowCount: 0,
  hits: [],
  lastTick: 0,
};

export const DEFAULT_CONFIG: LimiterConfig = {
  capacity: 24,
  refillRate: 15,
  requestRate: 19,
  windowSeconds: 10,
};

export interface AlgorithmMeta {
  id: AlgorithmId;
  label: string;
  tab: string;
  icon: string;
  tagline: string;
  essence: string;
  capacityLabel: string;
  refillLabel: string;
  windowVisible: boolean;
  memory: string;
  burst: string;
  pros: string[];
  cons: string[];
}

export const ALGORITHMS: Record<AlgorithmId, AlgorithmMeta> = {
  "token-bucket": {
    id: "token-bucket",
    label: "Token Bucket",
    tab: "Token Bucket",
    icon: "circle-dot",
    tagline: "Steady refill, tolerant of bursts",
    essence:
      "A bucket holds up to `capacity` tokens and refills at `refillRate` tokens/sec. Each request consumes one token; an empty bucket returns 429.",
    capacityLabel: "Burst Capacity (bucket size)",
    refillLabel: "Refill Rate (tokens / sec)",
    windowVisible: false,
    memory: "O(1) — two integers + timestamp",
    burst: "Allows short bursts up to bucket size, then settles to refill rate",
    pros: ["Constant memory", "Burst friendly", "Smooth average rate"],
    cons: ["Refill quantum can leak precision", "Needs tuning of two params"],
  },
  "leaky-bucket": {
    id: "leaky-bucket",
    label: "Leaky Bucket",
    tab: "Leaky Bucket",
    icon: "droplets",
    tagline: "Shapes traffic into a constant outflow",
    essence:
      "Requests pour into a bucket that drains at `refillRate` requests/sec. If the bucket overflows past `capacity` the request is rejected.",
    capacityLabel: "Bucket Size (queue depth)",
    refillLabel: "Leak Rate (drain / sec)",
    windowVisible: false,
    memory: "O(1) — water level + timestamp",
    burst: "Bursts are buffered then smoothed — never served faster than leak rate",
    pros: ["Perfect output shaping", "Very cheap", "Great for queues & workers"],
    cons: ["Adds queuing latency", "Old bursts are forgotten"],
  },
  "fixed-window": {
    id: "fixed-window",
    label: "Fixed Window Counter",
    tab: "Fixed Window",
    icon: "calculator",
    tagline: "Cheapest — with a boundary catch",
    essence:
      "Count requests inside a discrete `windowSeconds` bucket. Reset the counter when the window rolls over; reject once `capacity` is hit.",
    capacityLabel: "Window Limit (requests / window)",
    refillLabel: "Recovery Rate (instant on reset)",
    windowVisible: true,
    memory: "O(1) — counter + window id",
    burst: "2× limit possible across a window boundary",
    pros: ["Extremely cheap", "Trivial in Redis", "Predictable quotas"],
    cons: ["Boundary burst up to 2× limit", "Cliff-edge resets"],
  },
  "sliding-window": {
    id: "sliding-window",
    label: "Sliding Window Log",
    tab: "Sliding Window",
    icon: "activity",
    tagline: "Most accurate, most expensive",
    essence:
      "Keep a timestamped log of every request in the trailing `windowSeconds`. A request passes only while the log holds fewer than `capacity` hits.",
    capacityLabel: "Trailing Limit (requests / window)",
    refillLabel: "Recovery Rate (continuous)",
    windowVisible: true,
    memory: "O(capacity) — timestamp log",
    burst: "Strictly capped — no boundary bursts, exact rolling quota",
    pros: ["Exact rolling limit", "No boundary spikes", "Fair admission"],
    cons: ["Memory heavy at scale", "Needs sorted-set pruning"],
  },
};

export const ALGO_ORDER: AlgorithmId[] = [
  "token-bucket",
  "leaky-bucket",
  "fixed-window",
  "sliding-window",
];

/* -------------------------------- math -------------------------------- */

function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Poisson sampler — models realistic request arrivals. */
export function poisson(lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 25) {
    const n = Math.round(lambda + Math.sqrt(lambda) * gaussian());
    return Math.max(0, n);
  }
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

/* ------------------------------ engine ------------------------------- */

/** Advance refill / drain / window rollover up to `now`. */
export function advance(
  state: LimiterState,
  cfg: LimiterConfig,
  algo: AlgorithmId,
  now: number,
): LimiterState {
  const dt = Math.min(2000, Math.max(0, now - (state.lastTick || now))) / 1000;
  const next: LimiterState = { ...state, lastTick: now };

  if (algo === "token-bucket") {
    next.tokens = Math.min(cfg.capacity, state.tokens + cfg.refillRate * dt);
  } else if (algo === "leaky-bucket") {
    next.water = Math.max(0, state.water - cfg.refillRate * dt);
  } else if (algo === "fixed-window") {
    const winMs = cfg.windowSeconds * 1000;
    if (now - state.windowStart >= winMs) {
      const skipped = Math.floor((now - state.windowStart) / winMs);
      next.windowStart = state.windowStart + skipped * winMs;
      next.windowCount = 0;
    }
  } else {
    const cutoff = now - cfg.windowSeconds * 1000;
    if (state.hits.length && state.hits[0] < cutoff) {
      next.hits = state.hits.filter((t) => t >= cutoff);
    }
  }
  return next;
}

export interface AcquireResult {
  state: LimiterState;
  allowed: boolean;
  retryAfter: number;
  tokensAfter: number;
}

/** Try to admit a single request at `now`. */
export function acquire(
  state: LimiterState,
  cfg: LimiterConfig,
  algo: AlgorithmId,
  now: number,
): AcquireResult {
  const seeded = seedState(state, cfg, algo, now);
  const advanced = advance(seeded, cfg, algo, now);

  if (algo === "token-bucket") {
    if (advanced.tokens >= 1) {
      const tokensAfter = advanced.tokens - 1;
      return { state: { ...advanced, tokens: tokensAfter }, allowed: true, retryAfter: 0, tokensAfter };
    }
    const need = 1 - advanced.tokens;
    return {
      state: advanced,
      allowed: false,
      retryAfter: Math.max(0.05, need / Math.max(0.1, cfg.refillRate)),
      tokensAfter: advanced.tokens,
    };
  }

  if (algo === "leaky-bucket") {
    const water = advanced.water + 1;
    if (water <= cfg.capacity) {
      return { state: { ...advanced, water }, allowed: true, retryAfter: 0, tokensAfter: cfg.capacity - water };
    }
    return {
      state: { ...advanced, water: cfg.capacity },
      allowed: false,
      retryAfter: Math.max(0.05, (water - cfg.capacity) / Math.max(0.1, cfg.refillRate)),
      tokensAfter: 0,
    };
  }

  if (algo === "fixed-window") {
    const resetIn = Math.max(0.01, (advanced.windowStart + cfg.windowSeconds * 1000 - now) / 1000);
    if (advanced.windowCount < cfg.capacity) {
      const windowCount = advanced.windowCount + 1;
      return {
        state: { ...advanced, windowCount },
        allowed: true,
        retryAfter: 0,
        tokensAfter: cfg.capacity - windowCount,
      };
    }
    return { state: advanced, allowed: false, retryAfter: resetIn, tokensAfter: 0 };
  }

  const cutoff = now - cfg.windowSeconds * 1000;
  const live = advanced.hits.filter((t) => t >= cutoff);
  const resetIn = live.length ? Math.max(0.01, (live[0] + cfg.windowSeconds * 1000 - now) / 1000) : 0;
  if (live.length < cfg.capacity) {
    const hits = [...live, now];
    return {
      state: { ...advanced, hits },
      allowed: true,
      retryAfter: 0,
      tokensAfter: cfg.capacity - hits.length,
    };
  }
  return { state: { ...advanced, hits: live }, allowed: false, retryAfter: resetIn, tokensAfter: 0 };
}

/** Fill in defaults for a brand-new (never ticked) state. */
export function seedState(
  state: LimiterState,
  cfg: LimiterConfig,
  algo: AlgorithmId,
  now: number,
): LimiterState {
  if (state.lastTick !== 0) return state;
  return {
    ...state,
    tokens: algo === "token-bucket" ? cfg.capacity : state.tokens,
    windowStart: now,
    lastTick: now,
  };
}

export function createState(cfg: LimiterConfig, algo: AlgorithmId, now: number): LimiterState {
  return seedState(EMPTY_STATE, cfg, algo, now);
}

/** Live "how full is the tank" ratio, 0 → 1. */
export function fillRatio(state: LimiterState, cfg: LimiterConfig, algo: AlgorithmId): number {
  if (algo === "token-bucket") return cfg.capacity ? state.tokens / cfg.capacity : 0;
  if (algo === "leaky-bucket") return cfg.capacity ? state.water / cfg.capacity : 0;
  if (algo === "fixed-window") return cfg.capacity ? state.windowCount / cfg.capacity : 0;
  return cfg.capacity ? Math.min(1, state.hits.length / cfg.capacity) : 0;
}

export function usedCount(state: LimiterState, algo: AlgorithmId): number {
  if (algo === "token-bucket") return Math.round(state.tokens);
  if (algo === "leaky-bucket") return Math.round(state.water);
  if (algo === "fixed-window") return state.windowCount;
  return state.hits.length;
}

export function remainingQuota(state: LimiterState, cfg: LimiterConfig, algo: AlgorithmId): number {
  if (algo === "token-bucket") return Math.floor(state.tokens);
  if (algo === "leaky-bucket") return Math.max(0, Math.floor(cfg.capacity - state.water));
  if (algo === "fixed-window") return Math.max(0, cfg.capacity - state.windowCount);
  return Math.max(0, cfg.capacity - state.hits.length);
}

/** Seconds until a request would be admitted again. */
export function secondsToReset(
  state: LimiterState,
  cfg: LimiterConfig,
  algo: AlgorithmId,
  now: number,
): number {
  if (algo === "token-bucket") {
    if (state.tokens >= 1) return 0;
    return (1 - state.tokens) / Math.max(0.1, cfg.refillRate);
  }
  if (algo === "leaky-bucket") {
    if (state.water < cfg.capacity) return 0;
    return (state.water - cfg.capacity + 1) / Math.max(0.1, cfg.refillRate);
  }
  if (algo === "fixed-window") {
    return Math.max(0, (state.windowStart + cfg.windowSeconds * 1000 - now) / 1000);
  }
  if (!state.hits.length) return 0;
  const cutoff = now - cfg.windowSeconds * 1000;
  const live = state.hits.filter((t) => t >= cutoff);
  if (live.length < cfg.capacity) return 0;
  return Math.max(0, (live[0] + cfg.windowSeconds * 1000 - now) / 1000);
}

export function buildHeaders(
  state: LimiterState,
  cfg: LimiterConfig,
  algo: AlgorithmId,
  now: number,
  throttled: boolean,
): HeaderSet {
  const reset = secondsToReset(state, cfg, algo, now);
  const remaining = remainingQuota(state, cfg, algo);
  const limit =
    algo === "token-bucket" || algo === "leaky-bucket"
      ? `${cfg.capacity} burst / ${cfg.refillRate} rps`
      : `${cfg.capacity} / ${cfg.windowSeconds}s`;
  return {
    limit,
    remaining: String(remaining),
    reset: String(Math.max(0, Math.ceil(reset))),
    retryAfter: throttled ? String(Math.max(1, Math.ceil(reset))) : "—",
    policy: `${algo}-limit; capacity=${cfg.capacity}`,
    resetKind:
      algo === "fixed-window"
        ? "window rollover"
        : algo === "sliding-window"
          ? "oldest hit expiry"
          : "token refill",
  };
}

/* ---------------------------- traffic looks --------------------------- */

const METHODS = ["GET", "GET", "GET", "POST", "PUT", "DELETE", "PATCH"] as const;
const PATHS = [
  "/v1/users",
  "/v1/users/:id",
  "/v1/orders",
  "/v1/orders/:id/search",
  "/v1/invoices",
  "/v1/webhooks/dispatch",
  "/v1/analytics/rollup",
  "/v1/auth/token",
  "/v1/media/upload",
  "/v1/search?q=rate",
];

export function randomRequest() {
  const method = METHODS[Math.floor(Math.random() * METHODS.length)];
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const ip = `10.0.${Math.floor(Math.random() * 4)}.${Math.floor(Math.random() * 254) + 1}`;
  return { method, path, ip };
}

export const fmt = new Intl.NumberFormat("en-US");
