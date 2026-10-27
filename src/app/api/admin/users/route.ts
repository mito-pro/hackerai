import { NextResponse } from "next/server";
import { requireAdmin, revokeUserSessions } from "@/lib/auth";
import { apiHandler, badRequest, readJson } from "@/lib/errors";
import { all, get, run } from "@/lib/db";
import { getPlan, listPlans } from "@/lib/plans";
import { z } from "zod";

export const runtime = "nodejs";

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();

  const rows = all<{
    id: string;
    email: string;
    name: string;
    role: string;
    plan_id: string;
    status: string;
    tokens_used: number;
    messages_today: number;
    token_override: number | null;
    created_at: string;
    last_login_at: string | null;
    requests: number;
  }>(
    `SELECT u.*, (SELECT COUNT(*) FROM usage_logs l WHERE l.user_id = u.id) AS requests
     FROM users u
     ORDER BY u.created_at DESC`
  );

  const filtered = search
    ? rows.filter(
        (row) =>
          row.email.toLowerCase().includes(search) ||
          row.name.toLowerCase().includes(search)
      )
    : rows;

  return NextResponse.json({
    users: filtered.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      planId: row.plan_id,
      status: row.status,
      tokensUsed: row.tokens_used,
      messagesToday: row.messages_today,
      tokenOverride: row.token_override,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      requests: row.requests,
    })),
    plans: listPlans(),
  });
});

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum([
    "set_plan",
    "set_status",
    "set_token_override",
    "reset_usage",
    "set_role",
  ]),
  value: z.union([z.string(), z.number(), z.null()]).optional(),
});

export const PATCH = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  const raw = await readJson(request);
  if (!raw.ok) return badRequest();
  const parsed = patchSchema.safeParse(raw.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", message: "Payload invalido." },
      { status: 400 }
    );
  }

  const { id, action, value } = parsed.data;
  const target = get<{ id: string; role: string }>(
    "SELECT id, role FROM users WHERE id = ?",
    [id]
  );
  if (!target) {
    return NextResponse.json(
      { error: "not_found", message: "Usuario nao encontrado." },
      { status: 404 }
    );
  }

  switch (action) {
    case "set_plan": {
      const planId = String(value ?? "");
      if (!getPlan(planId)) {
        return NextResponse.json(
          { error: "bad_request", message: "Plano inexistente." },
          { status: 400 }
        );
      }
      run("UPDATE users SET plan_id = ? WHERE id = ?", [planId, id]);
      break;
    }
    case "set_status": {
      const status = String(value ?? "active");
      if (status !== "active" && status !== "banned") {
        return NextResponse.json(
          { error: "bad_request", message: "Status invalido." },
          { status: 400 }
        );
      }
      if (id === admin.id && status === "banned") {
        return NextResponse.json(
          { error: "forbidden", message: "Voce nao pode banir a propria conta." },
          { status: 400 }
        );
      }
      run("UPDATE users SET status = ? WHERE id = ?", [status, id]);
      if (status === "banned") {
        revokeUserSessions(id);
      }
      break;
    }
    case "set_role": {
      const role = String(value ?? "user");
      if (role !== "user" && role !== "admin") {
        return NextResponse.json(
          { error: "bad_request", message: "Papel invalido." },
          { status: 400 }
        );
      }
      if (id === admin.id && role !== "admin") {
        return NextResponse.json(
          { error: "forbidden", message: "Voce nao pode remover o proprio admin." },
          { status: 400 }
        );
      }
      run("UPDATE users SET role = ? WHERE id = ?", [role, id]);
      break;
    }
    case "set_token_override": {
      if (value === null || value === "" || value === undefined) {
        run("UPDATE users SET token_override = NULL WHERE id = ?", [id]);
      } else {
        const limit = Number(value);
        if (!Number.isFinite(limit) || limit < 1) {
          return NextResponse.json(
            {
              error: "bad_request",
              message:
                "Limite invalido. Use um numero maior que zero ou deixe vazio para voltar ao plano.",
            },
            { status: 400 }
          );
        }
        run("UPDATE users SET token_override = ? WHERE id = ?", [Math.floor(limit), id]);
      }
      break;
    }
    case "reset_usage": {
      run("UPDATE users SET tokens_used = 0, messages_today = 0 WHERE id = ?", [
        id,
      ]);
      break;
    }
  }

  const updated = get<{
    id: string;
    email: string;
    name: string;
    role: string;
    plan_id: string;
    status: string;
    tokens_used: number;
    messages_today: number;
    token_override: number | null;
  }>("SELECT * FROM users WHERE id = ?", [id]);

  return NextResponse.json({ ok: true, user: updated });
});
