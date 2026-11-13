import { all, run } from "./db";

export type ScanHistoryRow = {
  id: string;
  user_id: string;
  user_email: string;
  url: string;
  score: number;
  findings_count: number;
  criticals: number;
  highs: number;
  status: string;
  created_at: string;
};

export async function saveScanHistory(entry: {
  id: string;
  userId: string;
  userEmail: string;
  url: string;
  score: number;
  findingsCount: number;
  criticals: number;
  highs: number;
  status?: string;
}): Promise<void> {
  await run(
    `INSERT INTO scan_history
      (id, user_id, user_email, url, score, findings_count, criticals, highs, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.userId,
      entry.userEmail,
      entry.url.slice(0, 300),
      entry.score,
      entry.findingsCount,
      entry.criticals,
      entry.highs,
      entry.status ?? "ok",
      new Date().toISOString(),
    ]
  );
}

export async function listScanHistory(
  userId?: string | null,
  limit = 20
): Promise<ScanHistoryRow[]> {
  const size = Math.max(1, Math.min(100, Math.floor(limit)));
  if (userId) {
    return await all<ScanHistoryRow>(
      `SELECT * FROM scan_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ${size}`,
      [userId]
    );
  }
  return await all<ScanHistoryRow>(
    `SELECT * FROM scan_history ORDER BY created_at DESC LIMIT ${size}`
  );
}
