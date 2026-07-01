const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

export interface GoogleProfile {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

/** True when both Google OAuth credentials are configured. */
export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Build the Google authorization URL for the OAuth 2.0 code flow. */
export function getGoogleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens, then fetch the user's profile.
 * Throws on any failure.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth is not configured.');
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => '');
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${detail}`);
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error('Google token response did not include an access token.');
  }

  const userRes = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });

  if (!userRes.ok) {
    const detail = await userRes.text().catch(() => '');
    throw new Error(`Google userinfo request failed (${userRes.status}): ${detail}`);
  }

  const profile = (await userRes.json()) as {
    sub?: string;
    name?: string;
    email?: string;
    picture?: string;
  };

  if (!profile.sub || !profile.email) {
    throw new Error('Google profile is missing a subject id or email.');
  }

  return {
    id: profile.sub,
    name: profile.name ?? profile.email,
    email: profile.email,
    image: profile.picture ?? null,
  };
}
