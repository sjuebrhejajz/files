import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { r2, BUCKET_NAME } from "@/lib/r2"

const PRESENCE_KEY = "_system/presence.json"
const ACTIVE_WINDOW_MS = 20_000 // a session counts as "active" if seen in the last 20s

type PresenceMap = Record<string, number>

async function readPresence(): Promise<PresenceMap> {
  try {
    const obj = await r2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: PRESENCE_KEY }))
    const text = await obj.Body?.transformToString()
    return text ? (JSON.parse(text) as PresenceMap) : {}
  } catch {
    return {}
  }
}

async function writePresence(map: PresenceMap) {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: PRESENCE_KEY,
      Body: JSON.stringify(map),
      ContentType: "application/json",
    }),
  )
}

function prune(map: PresenceMap, now: number): PresenceMap {
  const next: PresenceMap = {}
  for (const [id, ts] of Object.entries(map)) {
    if (now - ts < ACTIVE_WINDOW_MS) next[id] = ts
  }
  return next
}

export async function heartbeat(sessionId: string) {
  const now = Date.now()
  const map = prune(await readPresence(), now)
  map[sessionId] = now
  await writePresence(map)
  return Object.keys(map).length
}

export async function activeCount() {
  const map = prune(await readPresence(), Date.now())
  return Object.keys(map).length
}
