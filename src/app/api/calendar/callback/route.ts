import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state') || '/tasks';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/calendar/callback`;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // GRACEFUL FALLBACK: If user denied authorization
  if (error || !code) {
    console.warn('[Google OAuth Warning] User denied authorization or missing code:', error);
    const returnUrl = new URL(state, appUrl);
    returnUrl.searchParams.set('calendar_error', error || 'access_denied');
    return NextResponse.redirect(returnUrl.toString());
  }

  try {
    console.log('[Google OAuth] Exchanging authorization code for access tokens...');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errTxt = await tokenRes.text();
      console.error('[Google OAuth Error] Token exchange failed:', errTxt);
      const returnUrl = new URL(state, appUrl);
      returnUrl.searchParams.set('calendar_error', 'token_exchange_failed');
      return NextResponse.redirect(returnUrl.toString());
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    console.log('[Google OAuth Success] Received Google Access Token!');

    const returnUrl = new URL(state, appUrl);
    returnUrl.searchParams.set('calendar_connected', 'true');

    const response = NextResponse.redirect(returnUrl.toString());
    
    // Store tokens in cookies
    if (accessToken) {
      response.cookies.set('google_access_token', accessToken, {
        httpOnly: true,
        path: '/',
        maxAge: tokenData.expires_in || 3600,
      });
    }

    if (refreshToken) {
      response.cookies.set('google_refresh_token', refreshToken, {
        httpOnly: true,
        path: '/',
        maxAge: 30 * 86400, // 30 days
      });
    }

    return response;

  } catch (err: any) {
    console.error('[Google OAuth Exception]:', err.message);
    const returnUrl = new URL(state, appUrl);
    returnUrl.searchParams.set('calendar_error', 'server_error');
    return NextResponse.redirect(returnUrl.toString());
  }
}
