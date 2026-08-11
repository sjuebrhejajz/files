import { NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { requireCurrentUser, isStaff, AuthError } from "@/lib/auth"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { hasDonatorPerks } from "@/lib/donations"
import { isBlacklisted, getClientIp } from "@/lib/blacklist"

// Static images only — explicitly no GIFs (they're allowed for avatars/banners,
// but not here) and no video, per the "no videos or gifs" requirement. This
// restriction stays in place even for staff — it's about format, not size.
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "image/tiff": "tiff",
}

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB — waived entirely for staff (mod/admin/owner)

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()

    // Server-side gate — the settings UI hides this from non-donors, but that's
    // not enforcement, so check again here regardless of what the client sends.
    // (hasDonatorPerks already treats admin/owner as donators, so staff never
    // actually hit this check — kept for moderators, who aren't auto-donators.)
    if (!isStaff(user) && !hasDonatorPerks(user)) {
      return NextResponse.json({ error: "Donate any amount to unlock custom themes." }, { status: 403 })
    }

    const body = await req.json()
    const contentType = String(body.contentType ?? "")
    const size = Number(body.size ?? 0)

    if (contentType === "image/gif" || contentType.startsWith("video/")) {
      return NextResponse.json({ error: "GIFs and videos aren't allowed for theme backgrounds." }, { status: 400 })
    }
    if (!EXT_BY_TYPE[contentType]) {
      return NextResponse.json({ error: "Unsupported image type." }, { status: 400 })
    }
    if (!size || (!isStaff(user) && size > MAX_BYTES)) {
      return NextResponse.json({ error: "Image must be 25 MB or smaller." }, { status: 400 })
    }

    const ip = getClientIp(req)
    if (await isBlacklisted({ ip, username: user.username, email: user.email })) {
      return NextResponse.json({ error: "Uploads are not available for this account." }, { status: 403 })
    }

    const ext = EXT_BY_TYPE[contentType]
    // Never served publicly (see app/a/[...path]/route.ts) — only the owner and
    // staff can ever fetch this, unlike avatars/banners which go public once approved.
    const key = `themes/${user.id}-${Date.now()}.${ext}`

    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType }),
      { expiresIn: 60 * 5 },
    )

    return NextResponse.json({ uploadUrl, key })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/theme-url]", err)
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 })
  }
}
