import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { listChats, pruneChats } from "@/lib/chats";
import { getPlan } from "@/lib/plans";
import { planForUser, syncCounters } from "@/lib/usage";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  const user = await requireUser();
  const fresh = syncCounters(user.id);
  const plan = fresh
    ? planForUser(fresh)
    : getPlan(user.planId) ?? getPlan("free")!;

  pruneChats(user.id, plan.historyDays);

  const chats = listChats(user.id);
  return NextResponse.json({ chats });
});
