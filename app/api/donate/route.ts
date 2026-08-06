import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getCurrentUser } from "@/lib/auth"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

const MIN_AMOUNT = 1 // £1 minimum
const MAX_AMOUNT = 1000 // £1000 sanity ceiling

export async function POST(req: Request) {
  try {
    const { amount } = (await req.json()) as { amount: number }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      return NextResponse.json({ error: `Amount must be between £${MIN_AMOUNT} and £${MAX_AMOUNT}` }, { status: 400 })
    }

    const origin = req.headers.get("origin") || new URL(req.url).origin

    // Attach the logged-in user's id (if any) so the webhook can credit the leaderboard.
    const user = await getCurrentUser()

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      metadata: user ? { userId: user.id } : undefined,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: "Donation" },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/?donated=1`,
      cancel_url: `${origin}/`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.log("[v0] donate session failed:", err)
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 })
  }
}
