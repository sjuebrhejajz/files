import { list } from "@vercel/blob"

export type ResolvedFile = {
  pathname: string
  url: string
  displayName: string
  size: number
  contentType: string
  uploadedAt: number
  kind: "video" | "image" | "audio" | "other"
}

function kindFor(contentType: string): ResolvedFile["kind"] {
  if (contentType.startsWith("video/")) return "video"
  if (contentType.startsWith("image/")) return "image"
  if (contentType.startsWith("audio/")) return "audio"
  return "other"
}

export function displayNameFor(pathname: string) {
  const name = pathname.split("/").pop() ?? pathname
  // Strip the leading "timestamp__f__shortId__" prefix we add on upload.
  let clean = name.replace(/^\d+__f__[^_]+__/, "")
  // Strip Blob's appended random suffix before the extension, e.g.
  // "clip-MwzVtRhXM4TA2YWKY9pgT81sxPirib.mp4" -> "clip.mp4".
  clean = clean.replace(/-[A-Za-z0-9]{20,}(\.[^.]+)?$/, "$1")
  return clean
}

// Finds a blob by its short id (embedded in the pathname as
// "<timestamp>__f__<shortId>__<name>"). Paginates through the store since
// Blob has no direct key lookup by an arbitrary substring.
export async function findBlobByShortId(shortId: string) {
  let cursor: string | undefined
  do {
    const result = await list({ cursor, limit: 1000 })
    const match = result.blobs.find((b) => b.pathname.includes(`__${shortId}__`))
    if (match) return match
    cursor = result.cursor
  } while (cursor)
  return null
}

export async function resolveFile(shortId: string): Promise<ResolvedFile | null> {
  const blob = await findBlobByShortId(shortId)
  if (!blob) return null

  // Fetch a HEAD-ish request to learn the content type.
  let contentType = "application/octet-stream"
  try {
    const head = await fetch(blob.url, { method: "HEAD" })
    contentType = head.headers.get("content-type") ?? contentType
  } catch {
    // ignore
  }

  const name = blob.pathname.split("/").pop() ?? ""
  const tsMatch = name.match(/^(\d+)__/)

  return {
    pathname: blob.pathname,
    url: blob.url,
    displayName: displayNameFor(blob.pathname),
    size: blob.size,
    contentType,
    uploadedAt: tsMatch ? Number(tsMatch[1]) : new Date(blob.uploadedAt).getTime(),
    kind: kindFor(contentType),
  }
}
