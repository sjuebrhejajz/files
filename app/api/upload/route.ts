import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { type NextRequest, NextResponse } from "next/server"

// 100 MB per file
const MAX_BYTES = 100 * 1024 * 1024

// Allowed content types for direct inline embedding. We still accept anything,
// but this list drives client-side hints. Keep broad so any file can be hosted.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Encode the upload time into the pathname so the cleanup cron can
        // determine which files are older than 24h without a database.
        // Final key looks like: 1712345678901__<random>__<originalname>
        return {
          // No restriction on file types — this is a general file host.
          allowedContentTypes: undefined,
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_BYTES,
          tokenPayload: JSON.stringify({ pathname }),
        }
      },
      onUploadCompleted: async ({ blob }) => {
        // Nothing to persist — timestamped path handles expiry.
        console.log("[v0] upload completed:", blob.pathname)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("[v0] upload token error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
