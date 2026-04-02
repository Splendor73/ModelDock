import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PanelProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "hero" | "muted";
  }
>;

const panelVariants: Record<NonNullable<PanelProps["variant"]>, string> = {
  default:
    "rounded-[28px] border border-border bg-[var(--surface-panel)] shadow-[0_18px_40px_rgba(0,0,0,0.24)]",
  hero:
    "rounded-[32px] border border-[var(--border-strong)] bg-[linear-gradient(180deg,var(--surface-panel-2),var(--surface-panel))] shadow-[0_28px_60px_rgba(0,0,0,0.3)]",
  muted:
    "rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
};

export function Panel({ className, variant = "default", ...props }: PanelProps) {
  return <div className={cn(panelVariants[variant], className)} {...props} />;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  icon?: LucideIcon;
};

const buttonVariants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_16px_34px_rgba(128,120,58,0.22)] hover:brightness-[1.06]",
  secondary:
    "border border-[var(--border-strong)] bg-[var(--surface-raised)] text-foreground hover:bg-[var(--surface-panel-2)]",
  ghost:
    "bg-transparent text-muted-foreground hover:bg-[var(--surface-muted)] hover:text-foreground",
};

export function ActionButton({
  children,
  className,
  icon: Icon,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "font-label inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold tracking-[0.02em] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
        buttonVariants[variant],
        className
      )}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  titleClassName?: string;
  descriptionClassName?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  titleClassName,
  descriptionClassName,
}: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-3xl">
        <p className="font-label text-[10px] uppercase tracking-[0.34em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1
          className={cn(
            "font-headline mt-3 text-[clamp(1.8rem,3.1vw,2.55rem)] font-black leading-[0.94] tracking-[-0.055em] text-foreground",
            titleClassName
          )}
        >
          {title}
        </h1>
        <p
          className={cn(
            "mt-3 max-w-2xl text-sm leading-7 text-muted-foreground",
            descriptionClassName
          )}
        >
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

type StatusPillProps = {
  label: string;
  value: string;
  online?: boolean;
  icon?: LucideIcon;
  className?: string;
  valueClassName?: string;
  detailClassName?: string;
};

export function StatusPill({
  label,
  value,
  online = true,
  icon: Icon,
  className,
}: StatusPillProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 py-2 text-xs shadow-[0_10px_26px_rgba(0,0,0,0.18)]",
        className
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          online
            ? "bg-primary shadow-[0_0_14px_rgba(128,120,58,0.75)]"
            : "bg-destructive shadow-[0_0_14px_rgba(239,90,90,0.55)]"
        )}
      />
      {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
      <span className="font-label uppercase tracking-[0.16em] text-[10px] text-muted-foreground">
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

type MetricCardProps = {
  label: string;
  value: string | number;
  detail?: string;
  icon?: LucideIcon;
  accent?: "primary" | "secondary" | "tertiary";
  className?: string;
  valueClassName?: string;
  detailClassName?: string;
};

const metricAccent: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  primary: "text-primary bg-[rgba(128,120,58,0.16)]",
  secondary: "text-[var(--color-secondary)] bg-[rgba(125,120,90,0.14)]",
  tertiary: "text-[var(--color-tertiary)] bg-[rgba(154,139,188,0.16)]",
};

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = "primary",
  className,
  valueClassName,
  detailClassName,
}: MetricCardProps) {
  return (
    <Panel className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-label text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "font-headline mt-5 max-w-[10ch] break-words text-[clamp(1.9rem,3vw,3rem)] font-black leading-[0.92] tracking-[-0.06em] text-foreground",
              valueClassName
            )}
          >
            {value}
          </p>
          {detail ? (
            <p className={cn("mt-2 text-xs leading-5 text-muted-foreground", detailClassName)}>
              {detail}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div className={cn("rounded-[18px] p-3", metricAccent[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

type BadgeProps = {
  tone?: "olive" | "lilac" | "neutral" | "danger" | "success";
  children: ReactNode;
  className?: string;
};

const badgeTones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  olive: "bg-[rgba(128,120,58,0.16)] text-primary",
  lilac: "bg-[rgba(154,139,188,0.16)] text-[var(--color-tertiary)]",
  neutral: "bg-[var(--surface-raised)] text-muted-foreground",
  danger: "bg-[rgba(239,90,90,0.16)] text-destructive",
  success: "bg-[rgba(125,120,90,0.18)] text-[var(--color-secondary)]",
};

export function DataBadge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "font-label inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  className?: string;
};

export function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <Panel
      variant="muted"
      className={cn("flex min-h-56 items-center justify-center px-6 py-10 text-center", className)}
    >
      <div className="max-w-md">
        <p className="font-headline text-xl font-bold tracking-[-0.04em] text-foreground">
          {title}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </Panel>
  );
}

export const surfaceClasses = {
  input:
    "h-11 w-full rounded-full border border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 text-sm text-foreground outline-none transition-all placeholder:text-[var(--text-tertiary)] focus:border-primary focus:ring-2 focus:ring-[rgba(128,120,58,0.22)]",
  select:
    "h-11 w-full rounded-full border border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-[rgba(128,120,58,0.22)]",
  textarea:
    "min-h-[120px] w-full rounded-[30px] border border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-[var(--text-tertiary)] focus:border-primary focus:ring-2 focus:ring-[rgba(128,120,58,0.22)]",
  tableWrap:
    "overflow-hidden rounded-[28px] border border-border bg-[var(--surface-panel)] shadow-[0_18px_40px_rgba(0,0,0,0.24)]",
  iconButton:
    "inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--surface-raised)] hover:text-foreground",
  mono: "font-mono text-xs tracking-[-0.01em]",
};
