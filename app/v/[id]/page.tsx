import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { resolveFile } from "@/lib/files"
import { FileViewer } from "@/components/file-viewer"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  const h = await headers()
  const host = h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  return host ? `${proto}://${host}` : "https://files.uncertain.uk"
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const file = await resolveFile(id)
  if (!file) return { title: "File not found" }

  const base = await siteUrl()
  const rawUrl = `${base}/f/${id}`
  const pageUrl = `${base}/v/${id}`

  // OpenGraph tags let Discord unfurl a rich inline player instead of a plain link.
  if (file.kind === "video") {
    return {
      title: file.displayName,
      openGraph: {
        title: file.displayName,
        type: "video.other",
        url: pageUrl,
        videos: [{ url: rawUrl, secureUrl: rawUrl, type: file.contentType, width: 1280, height: 720 }],
      },
      twitter: {
        card: "player",
        title: file.displayName,
        players: [{ playerUrl: rawUrl, streamUrl: rawUrl, width: 1280, height: 720 }],
      },
      other: {
        "og:video": rawUrl,
        "og:video:secure_url": rawUrl,
        "og:video:type": file.contentType,
        "og:video:width": "1280",
        "og:video:height": "720",
      },
    }
  }

  if (file.kind === "image") {
    return {
      title: file.displayName,
      openGraph: {
        title: file.displayName,
        url: pageUrl,
        images: [{ url: rawUrl }],
      },
      twitter: { card: "summary_large_image", title: file.displayName, images: [rawUrl] },
    }
  }

  return {
    title: file.displayName,
    openGraph: { title: file.displayName, url: pageUrl },
  }
}

export default async function ViewerPage({ params }: Props) {
  const { id } = await params
  const file = await resolveFile(id)
  if (!file) notFound()

  const rawUrl = `/f/${id}`
  return <FileViewer file={file} rawUrl={rawUrl} />
}
