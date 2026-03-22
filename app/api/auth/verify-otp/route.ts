import { NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth-session';
import { convexMutation, convexQuery } from '@/lib/convex-http';
import { sendWhatsApp, sendWhatsAppTemplate } from '@/lib/whatsapp-meta';

export const runtime = 'nodejs';

type VerifyOtpPayload = {
  phone?: string;
  code?: string;
  name?: string;
  email?: string;
  personality?: string;
};

function normalizePhone(phone: string) {
  const digits = phone.trim().replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildWelcomeMessage(name: string) {
  return `Hallo ${name}! 👋 Willkommen bei PadelClaw 🎾 Ich bin dein persönlicher Agent. Ich richte jetzt kurz alles mit dir ein. Erzähl mir zum Start: Wie lange coachst du schon und wie würdest du deinen Stil beschreiben?`;
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
  const personality = (payload.personality ?? 'friendly').trim() || 'friendly';

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
      // Check if trainer already exists — fail-open so OTP still succeeds
      let existingTrainerByPhone: { _id: string } | null = null;
      let existingTrainerByEmail: { _id: string } | null = null;

      try {
        [existingTrainerByPhone, existingTrainerByEmail] = await Promise.all([
          convexQuery<{ _id: string } | null>('trainers:getByPhone', { phone }),
          convexQuery<{ _id: string } | null>('trainers:getByEmail', { email }),
        ]);
      } catch (lookupError) {
        console.error('trainer lookup failed, will send welcome as fallback', lookupError);
        // fallback: treat as new trainer → send welcome
      }

      trainerId = await convexMutation<string>('trainers:ensureTrainer', {
        name,
        email,
        phone,
        plan: 'free',
        personality,
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

    console.log(`WELCOME_ATTEMPT: phone=${phone} shouldSend=${shouldSendWelcomeMessage} trainerId=${trainerId}`);

    if (trainerId && shouldSendWelcomeMessage) {
      try {
        await sendWhatsAppTemplate(phone, 'padelclaw_welcome', [name]);
        console.log(`WELCOME_TEMPLATE_SENT: phone=${phone}`);
      } catch (error) {
        console.error('welcome template failed, falling back to text', error);

        try {
          await sendWhatsApp(phone, buildWelcomeMessage(name));
          console.log(`WELCOME_FALLBACK_SENT: phone=${phone}`);
        } catch (fallbackError) {
          console.error('welcome whatsapp fallback failed', fallbackError);
        }
      }
    }

    return response;
  } catch (error) {
    console.error('verify-otp failed', error);
    return NextResponse.json({ error: 'OTP konnte nicht verifiziert werden.' }, { status: 500 });
  }
}
