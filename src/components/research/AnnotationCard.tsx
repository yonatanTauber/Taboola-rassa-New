"use client";

import Link from "next/link";
import { EntityLink } from "@/components/EntityLink";
import type { EntityType } from "@/lib/entity-config";

type AnnotationLink = {
  id: string;
  targetEntityType: string;
  targetEntityId: string;
  targetEntityAlias: string | null;
};

export type Annotation = {
  id: string;
  title: string;
  markdown: string;
  links: AnnotationLink[];
};

function targetTypeToEntityType(targetType: string): EntityType | null {
  switch (targetType) {
    case "PATIENT":
      return "patient";
    case "SESSION":
      return "session";
    case "TASK":
      return "task";
    case "RECEIPT":
      return "receipt";
    case "RESEARCH_DOCUMENT":
      return "research-document";
    case "RESEARCH_NOTE":
      return "research-note";
    default:
      return null;
  }
}

export function AnnotationCard({
  annotation,
  documentId,
  onEdit,
}: {
  annotation: Annotation;
  documentId: string;
  onEdit: () => void;
}) {
  // Filter out the implicit link to this document
  const extraLinks = annotation.links.filter(
    (lnk) => !(lnk.targetEntityType === "RESEARCH_DOCUMENT" && lnk.targetEntityId === documentId),
  );

  // Separate patient links (prominent at top) from other links
  const patientLinks = extraLinks.filter((lnk) => lnk.targetEntityType === "PATIENT");
  const otherLinks = extraLinks.filter((lnk) => lnk.targetEntityType !== "PATIENT");

  return (
    <li className="rounded-lg border border-black/15 bg-white/80 px-3 py-2.5 shadow-sm">
      {/* Patient names at top – prominent, clickable */}
      {patientLinks.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {patientLinks.map((lnk) => (
            <Link
              key={lnk.id}
              href={`/patients/${lnk.targetEntityId}`}
              className="inline-flex items-center gap-1 rounded-full bg-[#cee5d8] px-2 py-0.5 text-xs font-medium text-[#2f6d5a] transition hover:bg-[#b8d9c7]"
            >
              <span className="text-[9px]">◉</span>
              {lnk.targetEntityAlias ?? lnk.targetEntityId}
            </Link>
          ))}
        </div>
      ) : null}

      {/* Title + edit button */}
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm">{annotation.title}</div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-muted transition hover:bg-black/5 hover:text-accent"
        >
          עריכה
        </button>
      </div>

      {/* Content */}
      {annotation.markdown ? (
        <pre className="mt-1 whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted">
          {annotation.markdown}
        </pre>
      ) : null}

      {/* Other links (topics, documents) */}
      {otherLinks.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {otherLinks.map((lnk) => {
            const entityType = targetTypeToEntityType(lnk.targetEntityType);
            if (!entityType) {
              // OTHER = topic
              return (
                <span
                  key={lnk.id}
                  className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600"
                >
                  {lnk.targetEntityAlias ?? lnk.targetEntityId}
                </span>
              );
            }
            return (
              <EntityLink
                key={lnk.id}
                type={entityType}
                id={lnk.targetEntityId}
                label={lnk.targetEntityAlias ?? entityType}
              />
            );
          })}
        </div>
      ) : null}
    </li>
  );
}
