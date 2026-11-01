import * as React from "react";
import { cn } from "../utils/cn";

/* --------------------------------- Card --------------------------------- */

export function Card({
  className,
  glow,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { glow?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-hairline bg-panel/90 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_18px_40px_-24px_rgba(0,0,0,0.9)] backdrop-blur-sm",
        glow && "border-indigo-500/30 shadow-glow-indigo",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-hairline/80 px-4 py-3 sm:px-5",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs leading-relaxed text-slate-500", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-4 sm:px-5", className)} {...props} />;
}

/* -------------------------------- Button -------------------------------- */

type ButtonVariant = "primary" | "outline" | "ghost" | "danger" | "success" | "subtle";
type ButtonSize = "sm" | "md" | "icon" | "xs";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-400/40 shadow-[0_8px_24px_-10px_rgba(99,102,241,0.9)]",
  outline:
    "border border-hairline bg-panel-2/60 text-slate-200 hover:border-indigo-500/50 hover:text-white hover:bg-indigo-500/10",
  ghost: "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent",
  danger:
    "bg-rose-600/90 text-white hover:bg-rose-500 border border-rose-400/40 shadow-[0_8px_24px_-10px_rgba(244,63,94,0.9)]",
  success:
    "bg-emerald-600/90 text-white hover:bg-emerald-500 border border-emerald-400/40 shadow-[0_8px_24px_-10px_rgba(16,185,129,0.9)]",
  subtle: "border border-hairline bg-white/[0.03] text-slate-300 hover:bg-white/[0.07] hover:text-white",
};

const SIZES: Record<ButtonSize, string> = {
  xs: "h-7 gap-1.5 px-2.5 text-[10px]",
  sm: "h-8 gap-1.5 px-3 text-[11px]",
  md: "h-10 gap-2 px-4 text-xs",
  icon: "h-9 w-9 justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outline", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex shrink-0 select-none items-center rounded-lg font-mono font-semibold uppercase tracking-[0.1em] transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

/* --------------------------------- Badge -------------------------------- */

type BadgeTone = "success" | "danger" | "indigo" | "amber" | "neutral";

const TONES: Record<BadgeTone, string> = {
  success: "border-emerald-500/40 bg-emerald-500/12 text-emerald-300",
  danger: "border-rose-500/45 bg-rose-500/12 text-rose-300",
  indigo: "border-indigo-500/40 bg-indigo-500/12 text-indigo-300",
  amber: "border-amber-500/40 bg-amber-500/12 text-amber-300",
  neutral: "border-slate-600/60 bg-slate-700/25 text-slate-300",
};

export function Badge({
  tone = "neutral",
  className,
  dot,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />}
      {props.children}
    </span>
  );
}

/* -------------------------------- Slider -------------------------------- */

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  unit,
  hint,
  icon: Icon,
  accent = "indigo",
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  unit?: string;
  hint?: string;
  icon?: React.ElementType;
  accent?: "indigo" | "emerald" | "rose";
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const accentText =
    accent === "emerald" ? "text-emerald-300" : accent === "rose" ? "text-rose-300" : "text-indigo-300";
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {Icon && <Icon className={cn("h-3.5 w-3.5", accentText)} />}
          {label}
        </label>
        <span
          className={cn(
            "rounded-md border border-hairline bg-base/80 px-2 py-0.5 font-mono text-xs font-bold tabular-nums",
            accentText,
          )}
        >
          {value}
          {unit ? <span className="ml-0.5 text-[10px] text-slate-500">{unit}</span> : null}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--range-progress" as string]: `${pct}%` } as React.CSSProperties}
        className="h-4 w-full"
        aria-label={label}
      />
      {hint && <p className="font-mono text-[10px] leading-snug text-slate-600">{hint}</p>}
    </div>
  );
}

/* --------------------------------- Tabs --------------------------------- */

export function TabStrip<T extends string>({
  tabs,
  value,
  onChange,
  className,
  size = "md",
}: {
  tabs: { id: T; label: string; icon?: React.ElementType; badge?: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex w-full items-stretch gap-1 overflow-x-auto rounded-lg border border-hairline bg-base/70 p-1 no-scrollbar sm:w-auto",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-mono font-semibold uppercase tracking-[0.08em] transition-all duration-150 sm:flex-none",
              size === "sm" ? "h-7 px-2.5 text-[10px]" : "h-8 px-3 text-[11px]",
              active
                ? "bg-indigo-500/18 text-indigo-200 shadow-[0_0_0_1px_rgba(99,102,241,0.45)_inset,0_6px_20px_-12px_rgba(99,102,241,0.9)]"
                : "text-slate-500 hover:bg-white/5 hover:text-slate-200",
            )}
          >
            {Icon && <Icon className={cn("h-3.5 w-3.5", active && "text-indigo-300")} />}
            {t.label}
            {t.badge && (
              <span
                className={cn(
                  "rounded px-1 py-px text-[9px]",
                  active ? "bg-indigo-400/20 text-indigo-200" : "bg-white/5 text-slate-500",
                )}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------- Utilities ------------------------------ */

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-hairline", className)} />;
}

export function KeyVal({ k, v, mono = true }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{k}</span>
      <span className={cn("text-right text-xs text-slate-200", mono && "font-mono tabular-nums")}>{v}</span>
    </div>
  );
}

export function SectionLabel({ icon: Icon, children }: { icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-3.5 w-3.5 text-indigo-400" />}
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {children}
      </span>
    </div>
  );
}
