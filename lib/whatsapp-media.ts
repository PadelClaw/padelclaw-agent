const graphApiVersion = 'v22.0'

type MetaMediaResponse = {
  url?: string
  mime_type?: string
}

type AudioTranscriptionResponse = {
  text?: string
}

function getMetaAccessToken() {
  const accessToken = process.env.META_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error('Missing META_ACCESS_TOKEN')
  }

  return accessToken
}

function getFileExtension(mimeType: string | undefined) {
  if (!mimeType) {
    return 'ogg'
  }

  const normalizedMimeType = mimeType.toLowerCase()

  if (normalizedMimeType.includes('mpeg')) return 'mp3'
  if (normalizedMimeType.includes('mp4')) return 'mp4'
  if (normalizedMimeType.includes('wav')) return 'wav'
  if (normalizedMimeType.includes('webm')) return 'webm'
  if (normalizedMimeType.includes('ogg')) return 'ogg'
  if (normalizedMimeType.includes('aac')) return 'aac'
  if (normalizedMimeType.includes('amr')) return 'amr'

  return 'audio'
}

async function fetchMetaMedia(mediaId: string): Promise<MetaMediaResponse> {
  const accessToken = getMetaAccessToken()
  const response = await fetch(
    `https://graph.facebook.com/${graphApiVersion}/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Meta media lookup failed (${response.status}): ${errorText}`)
  }

  return (await response.json()) as MetaMediaResponse
}

async function downloadMetaMedia(url: string): Promise<Blob> {
  const accessToken = getMetaAccessToken()
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Meta media download failed (${response.status}): ${errorText}`)
  }

  return await response.blob()
}

async function transcribeWithProvider(
  apiKey: string,
  baseUrl: string,
  model: string,
  audioBlob: Blob,
  mimeType?: string,
) {
  const extension = getFileExtension(mimeType)
  const formData = new FormData()
  formData.append(
    'file',
    new File([audioBlob], `whatsapp-audio.${extension}`, {
      type: mimeType ?? 'application/octet-stream',
    }),
  )
  formData.append('model', model)

  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Audio transcription failed (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as AudioTranscriptionResponse
  return data.text?.trim() ?? ''
}

export async function transcribeAudio(mediaId: string): Promise<string> {
  const media = await fetchMetaMedia(mediaId)

  if (!media.url) {
    throw new Error('Meta media response missing url')
  }

  const audioBlob = await downloadMetaMedia(media.url)

  if (process.env.OLLAMA_API_KEY) {
    return await transcribeWithProvider(
      process.env.OLLAMA_API_KEY,
      'https://ollama.com/v1',
      process.env.OLLAMA_TRANSCRIPTION_MODEL ?? 'whisper-large-v3-turbo',
      audioBlob,
      media.mime_type,
    )
  }

  if (process.env.OPENAI_API_KEY) {
    return await transcribeWithProvider(
      process.env.OPENAI_API_KEY,
      'https://api.openai.com/v1',
      'whisper-1',
      audioBlob,
      media.mime_type,
    )
  }

  return '[Sprachnachricht - Transkription nicht verfügbar]'
}
