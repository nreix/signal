import { NextResponse } from "next/server";
import { supabase, SAVED_ITEMS } from "@/lib/supabase";
import type { Recommendation } from "@/types/content";

// Décisions stockées dans Supabase (table saved_items). Une ligne par contenu :
// kind = "watchlist" (dans la liste) ou "dismissed" (ne plus voir).

export async function GET() {
  if (!supabase) return NextResponse.json({ watchlist: [], dismissedIds: [] });
  const { data, error } = await supabase
    .from(SAVED_ITEMS)
    .select("item_id, kind, item")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { watchlist: [], dismissedIds: [], error: error.message },
      { status: 500 },
    );
  }

  const watchlist = data
    .filter((r) => r.kind === "watchlist" && r.item)
    .map((r) => r.item as Recommendation);
  const dismissedIds = data.filter((r) => r.kind === "dismissed").map((r) => r.item_id);
  return NextResponse.json({ watchlist, dismissedIds });
}

type Body =
  | { op: "save"; item: Recommendation }
  | { op: "dismiss"; id: string }
  | { op: "delete"; id: string };

export async function POST(req: Request) {
  if (!supabase) return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  let error = null;
  if (body.op === "save" && body.item?.id) {
    ({ error } = await supabase
      .from(SAVED_ITEMS)
      .upsert({ item_id: body.item.id, kind: "watchlist", item: body.item }));
  } else if (body.op === "dismiss" && body.id) {
    ({ error } = await supabase
      .from(SAVED_ITEMS)
      .upsert({ item_id: body.id, kind: "dismissed", item: null }));
  } else if (body.op === "delete" && body.id) {
    ({ error } = await supabase.from(SAVED_ITEMS).delete().eq("item_id", body.id));
  } else {
    return NextResponse.json({ ok: false, reason: "bad-op" }, { status: 400 });
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
