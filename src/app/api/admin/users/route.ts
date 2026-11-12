import { NextResponse } from "next/server";
import { requireAdmin, revokeUserSessions } from "@/lib/auth";
import { apiHandler, badRequest, readJson } from "@/lib/errors";
import { all, get, run } from "@/lib/db";
import { getPlan, listPlans } from "@/lib/plans";
import { logAudit, logPlanChange } from "@/lib/audit";
import { generateId } from "@/lib/utils";

import { sendAccountCreatedMail, sendPlanChangeMail } from "@/lib/mail";
import { getAppHost } from "@/lib/settings";
import { z } from "zod";

export const runtime = "nodejs";

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();

  const rows = await all<{
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
    plans: await listPlans(),
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

const createSchema = z.object({
  email: z.string().min(3).max(160),
  name: z.string().max(120).optional(),
  planId: z.string().min(1).optional(),
  role: z.enum(["user", "admin"]).optional(),
});

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  const raw = await readJson(request);
  if (!raw.ok) return badRequest();
  const parsed = createSchema.safeParse(raw.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", message: "Payload invalido." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { error: "bad_request", message: "E-mail invalido." },
      { status: 400 }
    );
  }

  const existing = await get<{ id: string }>("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) {
    return NextResponse.json(
      { error: "conflict", message: "Ja existe uma conta com este e-mail." },
      { status: 409 }
    );
  }

  const planId = parsed.data.planId || "free";
  if (!await getPlan(planId)) {
    return NextResponse.json(
      { error: "bad_request", message: "Plano inexistente." },
      { status: 400 }
    );
  }

  const id = generateId("usr");
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const role = parsed.data.role ?? "user";
  const name = parsed.data.name?.trim() || email.split("@")[0].replace(/[._-]+/g, " ");

  run(
    `INSERT INTO users (id, email, name, role, plan_id, status, tokens_used, messages_today, period_start, day_start, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, 'active', 0, 0, ?, ?, ?, NULL)`,
    [id, email, name, role, planId, day, day, now]
  );

  await logAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "user.create",
    targetType: "user",
    targetId: id,
    targetEmail: email,
    details: { planId, role, name },
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  const plan = await getPlan(planId);
  sendAccountCreatedMail({
    email,
    name,
    planName: plan?.name ?? planId,
    role,
    createdBy: admin.email,
    appHost: await getAppHost() || "hackerai-nexus.vercel.app",
  }).catch(() => undefined);

  const created = await get<{
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
  }>("SELECT * FROM users WHERE id = ?", [id]);

  return NextResponse.json({ ok: true, user: created }, { status: 201 });
});

export const DELETE = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  const raw = await readJson(request);
  if (!raw.ok) return badRequest();
  const id = String((raw.data as { id?: unknown })?.id ?? "").trim();
  if (!id) {
    return NextResponse.json(
      { error: "bad_request", message: "Informe o id do usuario." },
      { status: 400 }
    );
  }

  if (id === admin.id) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Voce nao pode apagar a propria conta.",
      },
      { status: 400 }
    );
  }

  const target = await get<{ id: string; email: string; role: string }>(
    "SELECT id, email, role FROM users WHERE id = ?",
    [id]
  );
  if (!target) {
    return NextResponse.json(
      { error: "not_found", message: "Usuario nao encontrado." },
      { status: 404 }
    );
  }

  if (target.role === "admin") {
    const count = await get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'admin'"
    );
    if (Number(count?.count ?? 0) <= 1) {
      return NextResponse.json(
        {
          error: "forbidden",
          message: "Este e o unico administrador ativo. Promova outro antes de apagar.",
        },
        { status: 400 }
      );
    }
  }

  await run("DELETE FROM messages WHERE user_id = ?", [id]);
  await run("DELETE FROM chats WHERE user_id = ?", [id]);
  await run("DELETE FROM usage_logs WHERE user_id = ?", [id]);
  await run("DELETE FROM plan_history WHERE user_id = ?", [id]);
  await run("DELETE FROM sessions WHERE user_id = ?", [id]);
  await run("DELETE FROM otp_codes WHERE email = ?", [target.email]);
  await run("DELETE FROM users WHERE id = ?", [id]);

  await logAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "user.delete",
    targetType: "user",
    targetId: id,
    targetEmail: target.email,
    details: { role: target.role },
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ ok: true, deleted: { id, email: target.email } });
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
  const target = await get<{
    id: string;
    email: string;
    name: string;
    role: string;
    plan_id: string;
    status: string;
    token_override: number | null;
    tokens_used: number;
    messages_today: number;
  }>("SELECT * FROM users WHERE id = ?", [id]);
  if (!target) {
    return NextResponse.json(
      { error: "not_found", message: "Usuario nao encontrado." },
      { status: 404 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  switch (action) {
    case "set_plan": {
      const planId = String(value ?? "");
      if (!await getPlan(planId)) {
        return NextResponse.json(
          { error: "bad_request", message: "Plano inexistente." },
          { status: 400 }
        );
      }
      run("UPDATE users SET plan_id = ? WHERE id = ?", [planId, id]);
      await logPlanChange({
        userId: id,
        userEmail: target.email,
        oldPlanId: target.plan_id,
        newPlanId: planId,
        changedById: admin.id,
        changedByEmail: admin.email,
      });
      await logAudit({
        actorId: admin.id,
        actorEmail: admin.email,
        action: "user.plan_change",
        targetType: "user",
        targetId: id,
        targetEmail: target.email,
        details: { oldPlanId: target.plan_id, newPlanId: planId },
        ip,
      });
      const oldPlan = await getPlan(target.plan_id);
      const newPlan = await getPlan(planId);
      sendPlanChangeMail({
        email: target.email,
        name: target.name,
        oldPlan: oldPlan?.name ?? target.plan_id,
        newPlan: newPlan?.name ?? planId,
        changedBy: admin.email,
        appHost: await getAppHost() || "hackerai-nexus.vercel.app",
      }).catch(() => undefined);
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
        await revokeUserSessions(id);
      }
      await logAudit({
        actorId: admin.id,
        actorEmail: admin.email,
        action: status === "banned" ? "user.ban" : "user.unban",
        targetType: "user",
        targetId: id,
        targetEmail: target.email,
        details: { status },
        ip,
      });
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
      await logAudit({
        actorId: admin.id,
        actorEmail: admin.email,
        action: "user.role_change",
        targetType: "user",
        targetId: id,
        targetEmail: target.email,
        details: { oldRole: target.role, newRole: role },
        ip,
      });
      break;
    }
    case "set_token_override": {
      if (value === null || value === "" || value === undefined) {
        run("UPDATE users SET token_override = NULL WHERE id = ?", [id]);
        await logAudit({
          actorId: admin.id,
          actorEmail: admin.email,
          action: "user.token_override",
          targetType: "user",
          targetId: id,
          targetEmail: target.email,
          details: { override: null },
          ip,
        });
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
        await logAudit({
          actorId: admin.id,
          actorEmail: admin.email,
          action: "user.token_override",
          targetType: "user",
          targetId: id,
          targetEmail: target.email,
          details: { override: Math.floor(limit) },
          ip,
        });
      }
      break;
    }
    case "reset_usage": {
      run("UPDATE users SET tokens_used = 0, messages_today = 0 WHERE id = ?", [
        id,
      ]);
      await logAudit({
        actorId: admin.id,
        actorEmail: admin.email,
        action: "user.reset_usage",
        targetType: "user",
        targetId: id,
        targetEmail: target.email,
        details: {
          oldTokens: target.tokens_used,
          oldMessages: target.messages_today,
        },
        ip,
      });
      break;
    }
  }

  const updated = await get<{
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
