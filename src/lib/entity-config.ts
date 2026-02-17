export type EntityType =
  | "patient"
  | "session"
  | "guidance"
  | "task"
  | "receipt"
  | "research-document"
  | "research-note"
  | "patient-note"
  | "inquiry"
  | "medical-document";

type EntityConfig = {
  label: string;
  labelShort: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  href: (id: string) => string;
};

export const ENTITY_CONFIG: Record<EntityType, EntityConfig> = {
  patient: {
    label: "מטופל",
    labelShort: "מטופל",
    icon: "◉",
    badgeBg: "bg-[#cee5d8]",
    badgeText: "text-[#2f6d5a]",
    href: (id) => `/patients/${id}`,
  },
  session: {
    label: "פגישה",
    labelShort: "פגישה",
    icon: "◷",
    badgeBg: "bg-[#d2ddec]",
    badgeText: "text-[#3b6a99]",
    href: (id) => `/sessions/${id}`,
  },
  guidance: {
    label: "הדרכה",
    labelShort: "הדרכה",
    icon: "✎",
    badgeBg: "bg-[#d6e0ec]",
    badgeText: "text-[#365a7b]",
    href: (id) => `/guidance/${id}`,
  },
  task: {
    label: "משימה",
    labelShort: "משימה",
    icon: "✓",
    badgeBg: "bg-amber-100/70",
    badgeText: "text-amber-700",
    href: (id) => `/tasks/${id}`,
  },
  receipt: {
    label: "קבלה",
    labelShort: "קבלה",
    icon: "₪",
    badgeBg: "bg-[#efdfc4]",
    badgeText: "text-[#8a6324]",
    href: (id) => `/receipts/${id}`,
  },
  "research-document": {
    label: "מסמך מחקר",
    labelShort: "מחקר",
    icon: "✦",
    badgeBg: "bg-[#dfd2e8]",
    badgeText: "text-[#7a4d99]",
    href: (id) => `/research/${id}`,
  },
  "research-note": {
    label: "פתק מחקר",
    labelShort: "פתק",
    icon: "✦",
    badgeBg: "bg-[#dfd2e8]",
    badgeText: "text-[#7a4d99]",
    href: () => `/research`,
  },
  "patient-note": {
    label: "פתק",
    labelShort: "פתק",
    icon: "◉",
    badgeBg: "bg-[#cee5d8]",
    badgeText: "text-[#2f6d5a]",
    href: () => `#`,
  },
  inquiry: {
    label: "פנייה",
    labelShort: "פנייה",
    icon: "◎",
    badgeBg: "bg-stone-200/70",
    badgeText: "text-stone-600",
    href: () => `/inquiries`,
  },
  "medical-document": {
    label: "מסמך רפואי",
    labelShort: "מסמך",
    icon: "◷",
    badgeBg: "bg-[#d2ddec]",
    badgeText: "text-[#3b6a99]",
    href: () => `#`,
  },
};
