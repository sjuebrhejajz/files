import { sql } from "@/lib/db"

export type UserTheme =
  | { mode: "default" }
  | { mode: "color"; color: string }
  | { mode: "image"; imageUrl: string }

// Strict 6-digit hex only. Validated again here (not just at save time) since
// this value is about to be interpolated into a <style> tag in app/layout.tsx —
// defense in depth against a bad row ever reaching that point.
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

export async function getUserTheme(userId: string): Promise<UserTheme> {
  const rows = await sql`select theme_mode, theme_color, theme_image_key from users where id = ${userId}`
  const row = rows[0]
  if (!row) return { mode: "default" }

  const mode = row.theme_mode as string
  const color = row.theme_color as string | null
  const imageKey = row.theme_image_key as string | null

  if (mode === "color" && color && HEX_COLOR_PATTERN.test(color)) {
    return { mode: "color", color }
  }
  if (mode === "image" && imageKey) {
    return { mode: "image", imageUrl: `/a/${imageKey}` }
  }
  return { mode: "default" }
}
