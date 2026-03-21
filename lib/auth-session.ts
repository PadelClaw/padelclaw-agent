import { createHmac } from 'node:crypto';

type SessionPayload = {
  trainerId: string;
  phone: string;
  exp: number;
};

const SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET || 'padelclaw-dev-session-secret-change-me';

function base64UrlEncode(value: string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function createSessionToken(trainerId: string, phone: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload: SessionPayload = {
    trainerId,
    phone,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac('sha256', SESSION_SECRET)
    .update(`${header}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${header}.${encodedPayload}.${signature}`;
}
