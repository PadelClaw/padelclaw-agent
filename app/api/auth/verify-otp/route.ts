import { NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth-session';
import { convexMutation, convexQuery } from '@/lib/convex-http';
import { sendWhatsApp } from '@/lib/whatsapp-meta';

export const runtime = 'nodejs';

type VerifyOtpPayload = {
  phone?: string;
  code?: string;
  name?: string;
  email?: string;
};

function normalizePhone(phone: string) {
  const digits = phone.trim().replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildWelcomeMessage(name: string) {
  return `Hallo ${name}! 👋 Willkommen bei PadelClaw 🎾 Ich bin dein KI-Assistent. Du kannst mir jetzt direkt über WhatsApp schreiben — zum Beispiel: "Zeig mir meine Buchungen für heute" oder "Buche morgen um 10 Uhr Padel 1". Los geht's! 🚀`;
}

export async function POST(request: Request) {
  let payload: VerifyOtpPayload;

  try {
    payload = (await request.json()) as VerifyOtpPayload;
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  const phone = normalizePhone(payload.phone ?? '');
  const code = (payload.code ?? '').trim();
  const name = (payload.name ?? '').trim();
  const email = normalizeEmail(payload.email ?? '');

  if (phone.replace(/\D/g, '').length < 8 || code.length !== 6) {
    return NextResponse.json({ error: 'Bitte prüfe Nummer und Code.' }, { status: 400 });
  }

  try {
    const otpResult = await convexMutation<{ success: boolean }>('otps:verify', {
      phone,
      code,
    });

    if (!otpResult.success) {
      return NextResponse.json({ error: 'Code ungültig oder abgelaufen.' }, { status: 401 });
    }

    let trainerId: string | null = null;
    let shouldSendWelcomeMessage = false;

    if (name && email) {
      const [existingTrainerByPhone, existingTrainerByEmail] = await Promise.all([
        convexQuery<{ _id: string } | null>('trainers:getByPhone', { phone }),
        convexQuery<{ _id: string } | null>('trainers:getByEmail', { email }),
      ]);
      trainerId = await convexMutation<string>('trainers:ensureTrainer', {
        name,
        email,
        phone,
        plan: 'free',
      });
      shouldSendWelcomeMessage = !existingTrainerByPhone && !existingTrainerByEmail;
    } else {
      const existingTrainer = await convexQuery<{ _id: string } | null>('trainers:getByPhone', { phone });
      trainerId = existingTrainer?._id ?? null;
    }

    const response = NextResponse.json({ success: true, trainerId: trainerId ?? undefined });

    if (trainerId) {
      const sessionToken = createSessionToken(trainerId, phone);
      response.cookies.set({
        name: 'padelclaw_session',
        value: sessionToken,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    if (trainerId && shouldSendWelcomeMessage) {
      sendWhatsApp(phone, buildWelcomeMessage(name)).catch((error) => {
        console.error('welcome whatsapp failed', error);
      });
    }

    return response;
  } catch (error) {
    console.error('verify-otp failed', error);
    return NextResponse.json({ error: 'OTP konnte nicht verifiziert werden.' }, { status: 500 });
  }
}
