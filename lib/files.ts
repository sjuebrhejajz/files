import { ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3"
import { r2, BUCKET_NAME } from "@/lib/r2"

export type ResolvedFile = {
  key: string
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

export function displayNameFor(key: string) {
  const name = key.split("/").pop() ?? key
  // Strip the leading "timestamp__f__shortId__" prefix we add on upload.
  return name.replace(/^\d+__f__[^_]+__/, "")
}

// Finds an object by its short id (embedded in the key as
// "<timestamp>__f__<shortId>__<name>"). Paginates through the bucket since R2
// has no direct lookup by an arbitrary substring.
export async function findKeyByShortId(shortId: string): Promise<string | null> {
  let ContinuationToken: string | undefined
  do {
    const result = await r2.send(
      new ListObjectsV2Command({ Bucket: BUCKET_NAME, ContinuationToken }),
    )
    const match = result.Contents?.find((o) => o.Key?.includes(`__${shortId}__`))
    if (match?.Key) return match.Key
    ContinuationToken = result.IsTruncated ? result.NextContinuationToken : undefined
  } while (ContinuationToken)
  return null
}

export async function resolveFile(shortId: string): Promise<ResolvedFile | null> {
  const key = await findKeyByShortId(shortId)
  if (!key) return null

  const head = await r2.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
  const contentType = head.ContentType ?? "application/octet-stream"
  const name = key.split("/").pop() ?? ""
  const tsMatch = name.match(/^(\d+)__/)

  return {
    key,
    displayName: displayNameFor(key),
    size: head.ContentLength ?? 0,
    contentType,
    uploadedAt: tsMatch ? Number(tsMatch[1]) : (head.LastModified?.getTime() ?? Date.now()),
    kind: kindFor(contentType),
  }
}
