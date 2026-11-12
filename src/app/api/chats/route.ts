import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { listChats, pruneChats } from "@/lib/chats";
import { getPlan } from "@/lib/plans";
import { planForUser, syncCounters } from "@/lib/usage";
import { maintenanceBlock } from "@/lib/maintenance";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  const user = await requireUser();
  const blocked = await maintenanceBlock(user);
  if (blocked) return blocked;
  const fresh = await syncCounters(user.id);
  const plan = fresh
    ? await planForUser(fresh)
    : await getPlan(user.planId) ?? (await getPlan("free"))!;

  await pruneChats(user.id, plan.historyDays);

  const chats = await listChats(user.id);
  return NextResponse.json({ chats });
});
