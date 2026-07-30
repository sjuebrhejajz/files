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
  // Strip the leading "timestamp__f__" prefix we add on upload.
  let clean = name.replace(/^\d+__[^_]*__/, "")
  // Strip Blob's appended random suffix before the extension, e.g.
  // "clip-MwzVtRhXM4TA2YWKY9pgT81sxPirib.mp4" -> "clip.mp4".
  clean = clean.replace(/-[A-Za-z0-9]{20,}(\.[^.]+)?$/, "$1")
  return clean
}

export async function resolveFile(id: string): Promise<ResolvedFile | null> {
  const decoded = decodeURIComponent(id)
  const { blobs } = await list({ prefix: decoded, limit: 1 })
  const blob = blobs.find((b) => b.pathname === decoded) ?? blobs[0]
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
