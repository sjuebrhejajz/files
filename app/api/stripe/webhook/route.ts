import { NextResponse } from "next/server"
import Stripe from "stripe"
import { sql } from "@/lib/db"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string

// Configure this URL (https://yourdomain.com/api/stripe/webhook) in the Stripe dashboard,
// listening for the "checkout.session.completed" event.
export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get("stripe-signature")

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature as string, webhookSecret)
  } catch (err) {
    console.error("[stripe/webhook] bad signature", err)
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.userId || null
    const amountCents = session.amount_total ?? 0

    try {
      await sql`
        insert into donations (user_id, amount_cents, stripe_session_id)
        values (${userId}, ${amountCents}, ${session.id})
        on conflict (stripe_session_id) do nothing
      `
      // Any amount unlocks donator status (badge, music widget, custom theme) —
      // logged-out donations have no userId and can't be credited to an account.
      if (userId) {
        await sql`update users set is_donator = true where id = ${userId}`
      }
    } catch (err) {
      console.error("[stripe/webhook] failed to record donation", err)
      return NextResponse.json({ error: "Could not record donation." }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
