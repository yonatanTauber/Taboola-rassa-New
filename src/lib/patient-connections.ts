export type ConnectionNodeKind =
  | "patient"
  | "session"
  | "task"
  | "guidance"
  | "research-note"
  | "research-document"
  | "receipt"
  | "external-link";

export type ConnectionEdgeRelation = "primary" | "secondary";

export type ConnectionGraphNode = {
  id: string;
  kind: ConnectionNodeKind;
  label: string;
  href: string;
  external?: boolean;
  priority: number;
  sortValue?: number;
  meta?: string | null;
};

export type ConnectionGraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: ConnectionEdgeRelation;
};

export type PatientConnectionsGraphData = {
  patientNodeId: string;
  nodes: ConnectionGraphNode[];
  edges: ConnectionGraphEdge[];
};

type BuildInput = {
  patient: { id: string; firstName: string; lastName: string };
  sessions: Array<{ id: string; scheduledAt: Date; status: string }>;
  tasks: Array<{ id: string; title: string; status: string; sessionId: string | null; dueAt: Date | null; createdAt: Date }>;
  guidances: Array<{
    id: string;
    title: string;
    status: string;
    scheduledAt: Date | null;
    updatedAt: Date;
    sessions: Array<{ session: { id: string } }>;
  }>;
  linkedResearchNotes: Array<{
    id: string;
    title: string;
    updatedAt: Date;
    documentId: string | null;
    documentTitle: string | null;
  }>;
  linkedResearchDocuments: Array<{ id: string; title: string; updatedAt?: Date | null }>;
  receipts: Array<{
    id: string;
    receiptNumber: string;
    amountNis: number;
    issuedAt: Date;
    paymentAllocations: Array<{ sessionId: string }>;
  }>;
  conceptLinks: Array<{ id: string; label: string; href: string | null; updatedAt?: Date }>;
};

export function buildPatientConnectionsGraphData(input: BuildInput): PatientConnectionsGraphData {
  const now = Date.now();
  const patientNodeId = `patient:${input.patient.id}`;
  const nodes = new Map<string, ConnectionGraphNode>();
  const edgeKeySet = new Set<string>();
  const edges: ConnectionGraphEdge[] = [];

  const patientLabel = `${input.patient.firstName} ${input.patient.lastName}`.trim();
  nodes.set(patientNodeId, {
    id: patientNodeId,
    kind: "patient",
    label: patientLabel,
    href: `/patients/${input.patient.id}`,
    priority: 0,
  });

  function upsertNode(node: ConnectionGraphNode) {
    const existing = nodes.get(node.id);
    if (!existing) {
      nodes.set(node.id, node);
      return;
    }
    if (node.priority < existing.priority) {
      nodes.set(node.id, { ...existing, ...node });
      return;
    }
    if (!existing.meta && node.meta) {
      nodes.set(node.id, { ...existing, meta: node.meta });
    }
  }

  function addEdge(source: string, target: string, relation: ConnectionEdgeRelation) {
    if (source === target) return;
    const key = `${source}->${target}`;
    if (edgeKeySet.has(key)) return;
    edgeKeySet.add(key);
    edges.push({ id: key, source, target, relation });
  }

  function connectToPatient(nodeId: string) {
    addEdge(patientNodeId, nodeId, "primary");
  }

  for (const session of input.sessions) {
    const sessionId = `session:${session.id}`;
    const sessionTs = session.scheduledAt.getTime();
    const isUpcoming = sessionTs >= now && session.status !== "CANCELED";
    upsertNode({
      id: sessionId,
      kind: "session",
      label: `פגישה ${session.scheduledAt.toLocaleDateString("he-IL")}`,
      meta: session.scheduledAt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
      href: `/sessions/${session.id}`,
      priority: isUpcoming ? 10 : 45,
      sortValue: sessionTs,
    });
    connectToPatient(sessionId);
  }

  for (const task of input.tasks) {
    const taskId = `task:${task.id}`;
    upsertNode({
      id: taskId,
      kind: "task",
      label: task.title || "משימה",
      href: `/tasks/${task.id}`,
      priority: task.status === "OPEN" ? 20 : 70,
      sortValue: (task.dueAt ?? task.createdAt).getTime(),
    });
    connectToPatient(taskId);
    if (task.sessionId) {
      addEdge(taskId, `session:${task.sessionId}`, "secondary");
    }
  }

  for (const guidance of input.guidances) {
    const guidanceId = `guidance:${guidance.id}`;
    upsertNode({
      id: guidanceId,
      kind: "guidance",
      label: guidance.title || "הדרכה",
      href: `/guidance/${guidance.id}`,
      priority: guidance.status === "ACTIVE" ? 30 : 60,
      sortValue: (guidance.scheduledAt ?? guidance.updatedAt).getTime(),
    });
    connectToPatient(guidanceId);
    for (const sessionLink of guidance.sessions) {
      addEdge(guidanceId, `session:${sessionLink.session.id}`, "secondary");
    }
  }

  for (const note of input.linkedResearchNotes) {
    if (!note.documentId) continue;
    const noteId = `research-note:${note.id}`;
    const docNodeId = `research-document:${note.documentId}`;
    upsertNode({
      id: noteId,
      kind: "research-note",
      label: note.title || "פתק מחקר",
      href: `/research/${note.documentId}`,
      priority: 40,
      sortValue: note.updatedAt.getTime(),
      meta: note.documentTitle ? `מקור: ${note.documentTitle}` : null,
    });
    connectToPatient(noteId);
    addEdge(noteId, docNodeId, "secondary");
  }

  for (const doc of input.linkedResearchDocuments) {
    const docId = `research-document:${doc.id}`;
    upsertNode({
      id: docId,
      kind: "research-document",
      label: doc.title || "מסמך מחקר",
      href: `/research/${doc.id}`,
      priority: 50,
      sortValue: doc.updatedAt?.getTime() ?? 0,
    });
    connectToPatient(docId);
  }

  for (const receipt of input.receipts) {
    const receiptId = `receipt:${receipt.id}`;
    upsertNode({
      id: receiptId,
      kind: "receipt",
      label: `קבלה #${receipt.receiptNumber}`,
      meta: `₪${receipt.amountNis.toLocaleString("he-IL")}`,
      href: `/receipts/${receipt.id}`,
      priority: 65,
      sortValue: receipt.issuedAt.getTime(),
    });
    connectToPatient(receiptId);
    for (const allocation of receipt.paymentAllocations) {
      addEdge(receiptId, `session:${allocation.sessionId}`, "secondary");
    }
  }

  for (const link of input.conceptLinks) {
    if (!link.href) continue;
    const externalId = `external-link:${link.id}`;
    upsertNode({
      id: externalId,
      kind: "external-link",
      label: link.label || "קישור חיצוני",
      href: link.href,
      external: true,
      priority: 80,
      sortValue: link.updatedAt?.getTime() ?? 0,
    });
    connectToPatient(externalId);
  }

  return {
    patientNodeId,
    nodes: [...nodes.values()],
    edges,
  };
}
