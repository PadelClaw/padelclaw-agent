const baseUrl =
  process.env.DIALOG360_BASE_URL ?? 'https://waba-sandbox.360dialog.io'

function normalizeRecipient(to: string) {
  return to.replace(/^whatsapp:/, '').trim()
}

export async function sendWhatsApp(to: string, body: string) {
  const apiKey = process.env.DIALOG360_API_KEY

  if (!apiKey) {
    throw new Error('Missing DIALOG360_API_KEY')
  }

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'D360-API-KEY': apiKey,
    },
    body: JSON.stringify({
      recipient_type: 'individual',
      to: normalizeRecipient(to),
      type: 'text',
      text: { body },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`360dialog send failed (${response.status}): ${errorText}`)
  }

  return response.json()
}
