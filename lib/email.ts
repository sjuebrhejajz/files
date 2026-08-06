import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

export async function sendVerificationEmail(to: string, code: string, purpose: "register" | "reset" | "login" | "email_change") {
  const subjects: Record<typeof purpose, string> = {
    register: "Verify your email",
    reset: "Reset your password",
    login: "Your login code",
    email_change: "Confirm your new email",
  }

  const heading: Record<typeof purpose, string> = {
    register: "Confirm your email address",
    reset: "Reset your password",
    login: "Your sign-in code",
    email_change: "Confirm your new email address",
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: subjects[purpose],
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${heading[purpose]}</h2>
        <p>Your verification code is:</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px;">${code}</p>
        <p style="color: #666; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  })
}
