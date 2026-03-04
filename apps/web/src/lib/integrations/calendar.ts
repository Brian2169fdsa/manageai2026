/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Google Calendar integration — creates events via the Google Calendar API.
 * Requires GOOGLE_CALENDAR_API_KEY and GOOGLE_CALENDAR_ID env vars.
 * Falls back gracefully to demo mode when not configured.
 */

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export function isConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN &&
    process.env.GOOGLE_CALENDAR_CLIENT_ID &&
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  );
}

/**
 * Gets an access token using the refresh token grant.
 */
async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error('[calendar] Token refresh failed:', res.status);
      return null;
    }

    const data = await res.json();
    return data.access_token ?? null;
  } catch (err: any) {
    console.error('[calendar] Token refresh error:', err.message);
    return null;
  }
}

export interface CalendarEvent {
  title: string;
  startTime: string; // ISO 8601
  endTime?: string; // ISO 8601, defaults to startTime + 1 hour
  description?: string;
  attendees?: string[]; // email addresses
  location?: string;
}

export interface CalendarResult {
  success: boolean;
  eventId?: string;
  htmlLink?: string;
  error?: string;
  demo?: boolean;
}

/**
 * Creates a Google Calendar event.
 * Returns a demo result if not configured.
 */
export async function createEvent(event: CalendarEvent): Promise<CalendarResult> {
  if (!isConfigured()) {
    console.log('[calendar] [DEMO MODE] createEvent:', event.title);
    return {
      success: true,
      demo: true,
      eventId: `demo-${Date.now()}`,
      htmlLink: '#demo',
    };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Failed to obtain access token' };
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary';

  // Default end time to 1 hour after start
  const start = new Date(event.startTime);
  const end = event.endTime
    ? new Date(event.endTime)
    : new Date(start.getTime() + 60 * 60 * 1000);

  const body: any = {
    summary: event.title,
    description: event.description ?? '',
    start: { dateTime: start.toISOString(), timeZone: 'America/New_York' },
    end: { dateTime: end.toISOString(), timeZone: 'America/New_York' },
  };

  if (event.attendees && event.attendees.length > 0) {
    body.attendees = event.attendees.map((email) => ({ email }));
  }

  if (event.location) {
    body.location = event.location;
  }

  try {
    const res = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('[calendar] Create event failed:', res.status, errText);
      return { success: false, error: `Calendar API returned ${res.status}` };
    }

    const data = await res.json();
    return {
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink,
    };
  } catch (err: any) {
    console.error('[calendar] Create event error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Lists upcoming events from the calendar.
 */
export async function listUpcomingEvents(maxResults: number = 10): Promise<any[]> {
  if (!isConfigured()) {
    console.log('[calendar] [DEMO MODE] listUpcomingEvents');
    return [
      {
        id: 'demo-1',
        summary: 'Weekly Team Standup',
        start: { dateTime: new Date().toISOString() },
        attendees: [{ email: 'team@manageai.io' }],
      },
      {
        id: 'demo-2',
        summary: 'Client Review — Acme Corp',
        start: { dateTime: new Date(Date.now() + 86400000).toISOString() },
        attendees: [{ email: 'dan@manageai.io' }],
      },
    ];
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return [];

  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary';
  const timeMin = new Date().toISOString();

  try {
    const res = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}
