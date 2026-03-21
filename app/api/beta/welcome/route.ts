import { NextResponse } from 'next/server';
import { sendWhatsApp } from '@/lib/whatsapp-meta';

export const runtime = 'nodejs';

type WelcomePayload = {
  name?: string;
  phone?: string;
};

function asCleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

export async function POST(request: Request) {
  let payload: WelcomePayload;

  try {
    payload = (await request.json()) as WelcomePayload;
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  const name = asCleanString(payload.name);
  const phone = normalizePhone(asCleanString(payload.phone));

  if (!name || phone.replace(/\D/g, '').length < 8) {
    return NextResponse.json(
      { error: 'Name und gültige WhatsApp-Nummer sind erforderlich.' },
      { status: 400 },
    );
  }

  try {
    await sendWhatsApp(
      phone,
      `Hola ${name}! 🎾 Ich bin dein PadelClaw-Assistent. Ich helfe dir mit Buchungen, Kalender und Spieler-Kommunikation. Möchtest du eine kurze Einführung? Antworte JA oder NEIN.`,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('beta welcome failed', error);
    return NextResponse.json(
      { error: 'Willkommensnachricht konnte nicht versendet werden.' },
      { status: 500 },
    );
  }
}
