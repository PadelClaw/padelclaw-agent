import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { convexMutation } from '@/lib/convex-http';

export const runtime = 'nodejs';

type SendOtpPayload = {
  email?: string;
  phone?: string;
};

function normalizePhone(phone: string) {
  const digits = phone.trim().replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request) {
  let payload: SendOtpPayload;

  try {
    payload = (await request.json()) as SendOtpPayload;
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  const email = normalizeEmail(payload.email ?? '');
  const phone = normalizePhone(payload.phone ?? '');
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' }, { status: 400 });
  }

  if (phone.replace(/\D/g, '').length < 8) {
    return NextResponse.json({ error: 'Bitte gib eine gültige WhatsApp-Nummer ein.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Resend ist nicht konfiguriert.' }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const code = generateOtpCode();

  try {
    await convexMutation('otps:create', {
      phone,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    await resend.emails.send({
      from: 'PadelClaw <onboarding@resend.dev>',
      to: email,
      subject: 'Dein PadelClaw Code',
      html: `<p>Dein Code: <strong>${code}</strong> 🎾</p><p>Gültig für 10 Minuten.</p>`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('send-otp failed', error);
    return NextResponse.json({ error: 'OTP konnte nicht versendet werden.' }, { status: 500 });
  }
}
