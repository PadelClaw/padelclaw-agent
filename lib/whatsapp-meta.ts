const graphApiVersion = 'v22.0'

function normalizeRecipient(to: string) {
  return to.replace(/^whatsapp:/, '').replace(/\D/g, '')
}

export async function sendWhatsApp(to: string, body: string) {
  const accessToken = process.env.META_ACCESS_TOKEN
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID

  if (!accessToken) {
    throw new Error('Missing META_ACCESS_TOKEN')
  }

  if (!phoneNumberId) {
    throw new Error('Missing META_PHONE_NUMBER_ID')
  }

  const response = await fetch(
    `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizeRecipient(to),
        type: 'text',
        text: { body },
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Meta WhatsApp send failed (${response.status}): ${errorText}`)
  }

  return response.json()
}
