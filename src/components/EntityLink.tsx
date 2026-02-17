import Link from "next/link";
import { ENTITY_CONFIG, type EntityType } from "@/lib/entity-config";
import { EntityBadge } from "@/components/EntityBadge";

export function EntityLink({
  type,
  id,
  label,
  meta,
  status,
  href,
  variant = "inline",
  external,
}: {
  type: EntityType;
  id: string;
  label: string;
  meta?: string;
  status?: { text: string; tone: string };
  href?: string;
  variant?: "inline" | "compact" | "card";
  external?: boolean;
}) {
  const config = ENTITY_CONFIG[type];
  const resolvedHref = href ?? config.href(id);

  if (variant === "inline") {
    if (external) {
      return (
        <a
          href={resolvedHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-accent transition hover:underline"
        >
          <EntityBadge type={type} showLabel={false} compact />
          <span>{label}</span>
        </a>
      );
    }
    return (
      <Link
        href={resolvedHref}
        className="inline-flex items-center gap-1.5 text-sm text-accent transition hover:underline"
      >
        <EntityBadge type={type} showLabel={false} compact />
        <span>{label}</span>
      </Link>
    );
  }

  if (variant === "compact") {
    const inner = (
      <>
        <EntityBadge type={type} compact />
        <span className="min-w-0 truncate font-medium text-ink">{label}</span>
        {meta ? (
          <>
            <span className="text-muted">·</span>
            <span className="text-muted">{meta}</span>
          </>
        ) : null}
        {status ? (
          <span className={`ms-auto rounded-full px-2 py-0.5 text-[11px] ${status.tone}`}>
            {status.text}
          </span>
        ) : null}
      </>
    );

    if (external) {
      return (
        <a
          href={resolvedHref}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm transition hover:bg-black/[0.02]"
        >
          {inner}
        </a>
      );
    }
    return (
      <Link
        href={resolvedHref}
        className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm transition hover:bg-black/[0.02]"
      >
        {inner}
      </Link>
    );
  }

  // card variant
  return (
    <Link
      href={resolvedHref}
      className="block rounded-xl border border-black/14 bg-white/96 px-3 py-2.5 transition hover:bg-black/[0.02]"
    >
      <div className="mb-1">
        <EntityBadge type={type} compact />
      </div>
      <div className="text-sm font-semibold text-ink">{label}</div>
      {meta ? <div className="mt-0.5 text-xs text-muted">{meta}</div> : null}
      {status ? (
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] ${status.tone}`}>
          {status.text}
        </span>
      ) : null}
    </Link>
  );
}
