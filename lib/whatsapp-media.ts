import { execSync } from 'child_process'
import * as fs from 'fs'

const graphApiVersion = 'v22.0'
const whisperBinary = '/Users/svc-agent/Library/Python/3.9/bin/whisper'
const transcriptionFallback = '[Sprachnachricht konnte nicht transkribiert werden]'

type MetaMediaResponse = {
  url?: string
  mime_type?: string
}

function getMetaAccessToken() {
  const accessToken = process.env.META_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error('Missing META_ACCESS_TOKEN')
  }

  return accessToken
}

function safeUnlink(path: string) {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path)
  }
}

export async function transcribeAudio(mediaId: string): Promise<string> {
  const audioPath = `/tmp/wa_audio_${mediaId}.ogg`
  const transcriptPath = `/tmp/wa_audio_${mediaId}.txt`

  try {
    const accessToken = getMetaAccessToken()
    const mediaResponse = await fetch(
      `https://graph.facebook.com/${graphApiVersion}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )

    if (!mediaResponse.ok) {
      throw new Error(`Meta media lookup failed: ${mediaResponse.status}`)
    }

    const media = (await mediaResponse.json()) as MetaMediaResponse

    if (!media.url) {
      throw new Error('Meta media response missing url')
    }

    const downloadResponse = await fetch(media.url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!downloadResponse.ok) {
      throw new Error(`Meta media download failed: ${downloadResponse.status}`)
    }

    const audioBuffer = Buffer.from(await downloadResponse.arrayBuffer())
    fs.writeFileSync(audioPath, audioBuffer)

    execSync(
      `${whisperBinary} ${audioPath} --model turbo --output_format txt --output_dir /tmp --language auto`,
      {
        stdio: 'pipe',
      },
    )

    const transcript = fs.readFileSync(transcriptPath, 'utf8').trim()
    safeUnlink(audioPath)
    safeUnlink(transcriptPath)

    return transcript || transcriptionFallback
  } catch {
    safeUnlink(audioPath)
    safeUnlink(transcriptPath)
    return transcriptionFallback
  }
}
