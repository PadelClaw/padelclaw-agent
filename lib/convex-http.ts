const DEFAULT_CONVEX_URL = 'https://intent-squirrel-292.eu-west-1.convex.cloud';

function getConvexBaseUrl() {
  const value =
    process.env.CONVEX_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    DEFAULT_CONVEX_URL;

  return value.replace(/\/api\/(mutation|query)$/, '').replace(/\/$/, '');
}

async function callConvex<T>(
  kind: 'mutation' | 'query',
  path: string,
  args: Record<string, unknown>,
) {
  const response = await fetch(`${getConvexBaseUrl()}/api/${kind}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path,
      args,
      format: 'json',
    }),
  });

  if (!response.ok) {
    throw new Error(`Convex ${kind} failed for ${path}: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { status?: string; value?: T };

  if (payload.status !== 'success') {
    throw new Error(`Convex ${kind} returned non-success for ${path}`);
  }

  return payload.value as T;
}

export function convexMutation<T>(path: string, args: Record<string, unknown>) {
  return callConvex<T>('mutation', path, args);
}

export function convexQuery<T>(path: string, args: Record<string, unknown>) {
  return callConvex<T>('query', path, args);
}
