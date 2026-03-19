import Twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const fromNumber = process.env.TWILIO_WHATSAPP_FROM!

const client = Twilio(accountSid, authToken)

export async function sendWhatsApp(to: string, body: string) {
  return client.messages.create({
    from: `whatsapp:${fromNumber}`,
    to,
    body,
  })
}
