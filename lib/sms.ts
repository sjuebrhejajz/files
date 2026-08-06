import twilio from "twilio"

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_FROM_NUMBER

export async function sendSmsCode(toPhoneNumber: string, code: string) {
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio env vars are not set (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).")
  }
  const client = twilio(accountSid, authToken)
  await client.messages.create({
    to: toPhoneNumber,
    from: fromNumber,
    body: `Your verification code is ${code}. It expires in 10 minutes.`,
  })
}
