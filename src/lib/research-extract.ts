import { PDFParse } from "pdf-parse";

const topicLexicon: Array<{ label: string; pattern: RegExp }> = [
  { label: "דיכאון", pattern: /דיכאון|depress/i },
  { label: "חרדה", pattern: /חרד|anxiet/i },
  { label: "טראומה", pattern: /טראומ|trauma|ptsd/i },
  { label: "אבל ואובדן", pattern: /אבל|אובדן|grief|bereave/i },
  { label: "ויסות רגשי", pattern: /ויסות|רגשי|emotion regulation/i },
  { label: "יחסים והתקשרות", pattern: /התקשרות|יחסים|attachment|relationship/i },
  { label: "התמכרויות", pattern: /התמכר|addict|substance/i },
  { label: "פסיכוזה", pattern: /פסיכוט|psychosis/i },
  { label: "מאניה", pattern: /מאני|mania|bipolar/i },
  { label: "אובדנות וסיכון", pattern: /אבדנ|suicid|self-harm|risk/i },
];

function cleanLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function guessTitle(lines: string, fallbackName: string) {
  const candidates = cleanLines(lines).filter((line) => line.length > 6 && line.length < 150);
  return candidates[0] ?? fallbackName.replace(/\.[^.]+$/, "");
}

function guessAuthors(text: string, metadataAuthor?: string | null) {
  const found = new Set<string>();
  if (metadataAuthor) {
    metadataAuthor
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => found.add(item));
  }
  const lines = cleanLines(text).slice(0, 20);
  for (const line of lines) {
    const m = line.match(/(?:authors?|by|מחבר(?:ים)?|כותב(?:ים)?)[\s:.-]+(.+)$/i);
    if (m?.[1]) {
      m[1]
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 1 && item.length < 80)
        .forEach((item) => found.add(item));
    }
  }
  return Array.from(found).slice(0, 8);
}

function guessTopics(text: string) {
  const normalized = text.slice(0, 80_000);
  return topicLexicon
    .map((item) => ({ label: item.label, score: normalized.match(item.pattern)?.length ?? 0 }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => item.label);
}

export async function extractResearchMetadata(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();

  let text = "";
  let metadataTitle: string | null | undefined;
  let metadataAuthor: string | null | undefined;

  if (file.type.includes("text") || lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
    text = bytes.toString("utf8");
  } else if (file.type.includes("pdf") || lowerName.endsWith(".pdf")) {
    const parser = new PDFParse({ data: bytes });
    const [textResult, infoResult] = await Promise.all([parser.getText(), parser.getInfo()]);
    text = textResult.text ?? "";
    metadataTitle = (infoResult.info?.Title as string | undefined) || null;
    metadataAuthor = (infoResult.info?.Author as string | undefined) || null;
    await parser.destroy();
  }

  const title = (metadataTitle && metadataTitle.trim()) || guessTitle(text, file.name);
  const authors = guessAuthors(text, metadataAuthor);
  const topics = guessTopics(text);

  return {
    title,
    authors,
    topics,
    ocrText: text.slice(0, 50_000),
  };
}
