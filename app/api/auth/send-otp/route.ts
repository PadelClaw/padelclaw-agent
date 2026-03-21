import { NextResponse } from 'next/server';
import { convexMutation } from '@/lib/convex-http';

export const runtime = 'nodejs';

function normalizePhone(phone: string) {
  const digits = phone.trim().replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request) {
  let payload: { phone?: string };

  try {
    payload = (await request.json()) as { phone?: string };
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  const phone = normalizePhone(payload.phone ?? '');

  if (phone.replace(/\D/g, '').length < 8) {
    return NextResponse.json({ error: 'Bitte gib eine gültige WhatsApp-Nummer ein.' }, { status: 400 });
  }

  const accessToken = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return NextResponse.json({ error: 'Meta WhatsApp ist nicht konfiguriert.' }, { status: 500 });
  }

  const code = generateOtpCode();

  try {
    await convexMutation('otps:create', {
      phone,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/\D/g, ''),
        type: 'text',
        text: {
          body: `Dein PadelClaw Code: ${code} 🎾 Gültig für 10 Minuten.`,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Meta send failed (${response.status}): ${await response.text()}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('send-otp failed', error);
    return NextResponse.json({ error: 'OTP konnte nicht versendet werden.' }, { status: 500 });
  }
}
