import { get, run } from "./db";

export type BlockReason = "deleted" | "banned";

// Usuarios apagados ficam numa lista de bloqueio permanente: o cookie de
// sessao assinado continua valido, entao sem esta lista a linha seria
// recriada "zumbi" no hydrateUser e o usuario continuaria usando o chat.

export async function isBlockedUser(params: {
  userId?: string | null;
  email?: string | null;
}): Promise<boolean> {
  const clauses: string[] = [];
  const values: (string | null)[] = [];
  if (params.userId) {
    clauses.push("user_id = ?");
    values.push(params.userId);
  }
  if (params.email) {
    clauses.push("email = ?");
    values.push(params.email.trim().toLowerCase());
  }
  if (clauses.length === 0) return false;
  const row = await get<{ user_id: string }>(
    `SELECT user_id FROM user_blocklist WHERE ${clauses.join(" OR ")} LIMIT 1`,
    values
  );
  return Boolean(row);
}

export async function blockUser(
  userId: string,
  email: string,
  reason: BlockReason = "deleted"
): Promise<void> {
  await run(
    `INSERT INTO user_blocklist (user_id, email, reason, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET email = excluded.email, reason = excluded.reason`,
    [userId, email.trim().toLowerCase(), reason, new Date().toISOString()]
  );
}

export async function unblockEmail(email: string): Promise<void> {
  await run("DELETE FROM user_blocklist WHERE email = ?", [
    email.trim().toLowerCase(),
  ]);
}
