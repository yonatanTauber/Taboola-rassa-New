import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";

function guessTopicsFromText(text: string) {
  const source = text.toLowerCase();
  const topics: string[] = [];
  if (source.includes("depress") || source.includes("דיכאון")) topics.push("דיכאון");
  if (source.includes("anx") || source.includes("חרד")) topics.push("חרדה");
  if (source.includes("trauma") || source.includes("טראומ")) topics.push("טראומה");
  if (source.includes("attach") || source.includes("התקשרות")) topics.push("יחסים והתקשרות");
  return topics;
}

function extractYouTubeTitleSeed(url: URL) {
  const v = url.searchParams.get("v");
  if (v) return `YouTube ${v}`;
  if (url.hostname.includes("youtu.be")) {
    const id = url.pathname.replace("/", "");
    if (id) return `YouTube ${id}`;
  }
  return "";
}

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const rawUrl = String(body.url ?? "").trim();
  if (!rawUrl) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  let title = "";
  let author = "";
  let source = url.hostname.replace(/^www\./, "");
  const topics: string[] = [];

  if (url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be")) {
    title = extractYouTubeTitleSeed(url);
    source = "YouTube";
  } else if (url.hostname.includes("vimeo.com")) {
    title = "Vimeo Video";
    source = "Vimeo";
  }

  try {
    if (url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be")) {
      const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`;
      const res = await fetch(oembed, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { title?: string; author_name?: string };
        title = data.title || title;
        author = data.author_name || author;
        topics.push(...guessTopicsFromText(`${data.title ?? ""} ${data.author_name ?? ""}`));
      }
    } else if (url.hostname.includes("vimeo.com")) {
      const oembed = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(rawUrl)}`;
      const res = await fetch(oembed, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { title?: string; author_name?: string };
        title = data.title || title;
        author = data.author_name || author;
        topics.push(...guessTopicsFromText(`${data.title ?? ""} ${data.author_name ?? ""}`));
      }
    }
  } catch {
    // Keep the flow resilient without blocking save.
  }

  return NextResponse.json({
    ok: true,
    metadata: {
      title: title || url.pathname.split("/").filter(Boolean).pop() || rawUrl,
      authors: author ? [author] : [],
      source,
      topics: Array.from(new Set(topics)),
    },
  });
}
