import { all, run } from "./db";
import { generateId } from "./utils";

export type AuditAction =
  | "user.create"
  | "user.update"
  | "user.delete"
  | "user.ban"
  | "user.unban"
  | "user.role_change"
  | "user.plan_change"
  | "user.token_override"
  | "user.reset_usage"
  | "plan.create"
  | "plan.update"
  | "plan.delete"
  | "settings.update"
  | "maintenance.toggle"
  | "provider.update"
  | "session.revoke"
  | "chat.delete"
  | "omega.setup"
  | "omega.decensor";

export type AuditTarget = "user" | "plan" | "settings" | "provider" | "session" | "chat" | "omega";

export async function logAudit(params: {
  actorId?: string | null;
  actorEmail: string;
  action: AuditAction;
  targetType: AuditTarget;
  targetId?: string | null;
  targetEmail?: string | null;
  details?: Record<string, unknown> | string | null;
  ip?: string | null;
}) {
  const id = generateId("aud");
  const details =
    params.details == null
      ? null
      : typeof params.details === "string"
        ? params.details
        : JSON.stringify(params.details);

  await run(
    `INSERT INTO audit_logs (id, actor_id, actor_email, action, target_type, target_id, target_email, details, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.actorId ?? null,
      params.actorEmail,
      params.action,
      params.targetType,
      params.targetId ?? null,
      params.targetEmail ?? null,
      details,
      params.ip ?? null,
      new Date().toISOString(),
    ]
  );

  return id;
}

export async function listAuditLogs(params?: {
  limit?: number;
  action?: string;
  targetType?: string;
  targetId?: string;
}) {
  const limit = Math.min(Math.max(params?.limit ?? 200, 1), 1000);
  const clauses: string[] = [];
  const values: Array<string | number> = [];

  if (params?.action) {
    clauses.push("action = ?");
    values.push(params.action);
  }
  if (params?.targetType) {
    clauses.push("target_type = ?");
    values.push(params.targetType);
  }
  if (params?.targetId) {
    clauses.push("target_id = ?");
    values.push(params.targetId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  return await all<{
    id: string;
    actor_id: string | null;
    actor_email: string;
    action: string;
    target_type: string;
    target_id: string | null;
    target_email: string | null;
    details: string | null;
    ip: string | null;
    created_at: string;
  }>(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ?`,
    [...values, limit]
  );
}
export async function logPlanChange(params: {
  userId: string;
  userEmail: string;
  oldPlanId: string | null;
  newPlanId: string;
  changedById: string;
  changedByEmail: string;
  reason?: string | null;
}) {
  const id = generateId("plh");
  await run(
    `INSERT INTO plan_history (id, user_id, user_email, old_plan_id, new_plan_id, changed_by, changed_by_email, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.userId,
      params.userEmail,
      params.oldPlanId,
      params.newPlanId,
      params.changedById,
      params.changedByEmail,
      params.reason ?? null,
      new Date().toISOString(),
    ]
  );
  return id;
}

export async function listPlanHistory(userId?: string, limit = 100) {
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  if (userId) {
    return await all<{
      id: string;
      user_id: string;
      user_email: string;
      old_plan_id: string | null;
      new_plan_id: string;
      changed_by: string;
      changed_by_email: string | null;
      reason: string | null;
      created_at: string;
    }>(
      `SELECT * FROM plan_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, safeLimit]
    );
  }

  return await all<{
    id: string;
    user_id: string;
    user_email: string;
    old_plan_id: string | null;
    new_plan_id: string;
    changed_by: string;
    changed_by_email: string | null;
    reason: string | null;
    created_at: string;
  }>(
    `SELECT * FROM plan_history ORDER BY created_at DESC LIMIT ?`,
    [safeLimit]
  );
}
