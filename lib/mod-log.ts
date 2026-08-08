import { sql } from "@/lib/db"

/**
 * Records a moderation action for the audit log. Best-effort — a logging
 * failure never blocks the actual moderation action, it just gets a console
 * error so it doesn't disappear silently either.
 */
export async function logModAction(
  actor: { id: string; username: string },
  action: string,
  target?: string | null,
  details?: string | null,
): Promise<void> {
  try {
    await sql`
      insert into moderation_logs (actor_id, actor_username, action, target, details)
      values (${actor.id}, ${actor.username}, ${action}, ${target ?? null}, ${details ?? null})
    `
  } catch (e) {
    console.error("[logModAction] failed:", e)
  }
}
