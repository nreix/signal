import { NextResponse } from "next/server";
import { getContentProvider } from "@/services/content";

// Restock : page supplémentaire de films/séries pour une section donnée.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "films";
  const section = url.searchParams.get("section") ?? "";
  const page = Number(url.searchParams.get("page") ?? "2");

  if (!section || !Number.isFinite(page) || page < 2 || page > 20) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await getContentProvider().getMore(kind, section, page);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
