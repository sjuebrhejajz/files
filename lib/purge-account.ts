import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { sql } from "@/lib/db"
import { r2, BUCKET_NAME } from "@/lib/r2"

/**
 * Permanently deletes a user account: their uploaded files, avatar/banner
 * moderation-history objects, music/video/theme assets, and the account row
 * itself (which cascades to sessions, trusted_devices, verification_codes,
 * image_moderation, user_ips, and user_badges via FK constraints).
 *
 * Caller is responsible for any staff-protection checks before calling this
 * — it doesn't check role itself, it just deletes.
 */
export async function purgeAccount(userId: string): Promise<void> {
  const rows = await sql`
    select music_object_key, video_object_key, theme_image_key from users where id = ${userId}
  `
  const row = rows[0]
  if (!row) return

  const [uploads, images] = await Promise.all([
    sql`select object_key from uploads where user_id = ${userId}`,
    sql`select object_key from image_moderation where user_id = ${userId}`,
  ])

  const keysToDelete = [...uploads.map((u) => u.object_key as string), ...images.map((i) => i.object_key as string)]
  if (row.music_object_key) keysToDelete.push(row.music_object_key as string)
  if (row.video_object_key) keysToDelete.push(row.video_object_key as string)
  if (row.theme_image_key) keysToDelete.push(row.theme_image_key as string)

  for (const key of keysToDelete) {
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
    } catch (e) {
      console.error("[purgeAccount] r2 delete failed:", key, e)
    }
  }

  // uploads.user_id is ON DELETE SET NULL (not cascade), so links have to be
  // removed explicitly — otherwise the rows would survive as orphaned entries.
  await sql`delete from uploads where user_id = ${userId}`

  // Deletes the account itself — cascades to sessions, trusted_devices,
  // verification_codes, image_moderation, user_ips, and user_badges via
  // their FK constraints. Donations are kept (user_id becomes null) so past
  // leaderboard totals aren't silently rewritten.
  await sql`delete from users where id = ${userId}`
}
