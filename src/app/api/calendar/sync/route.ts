import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { title, assignee, dueDate, meetingTitle, description } = body;

    // Retrieve Google Access Token from Cookie or Header
    let accessToken = req.cookies.get('google_access_token')?.value;
    const authHeader = req.headers.get('authorization');
    if (!accessToken && authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.replace('Bearer ', '').trim();
    }

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        requiresAuth: true,
        authUrl: '/api/calendar/auth',
        error: 'Google Calendar OAuth authorization required. Click "Connect Google Calendar" to grant permission.',
      }, { status: 401 });
    }

    const taskTitle = title || 'Verify AssemblyAI Speaker Diarization';
    const taskAssignee = assignee || 'Marcus Vance';
    const taskDueDate = dueDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const meetingName = meetingTitle || 'Sprint 15 Architecture Sync';

    // Format Start & End Times for Google Calendar API
    const startDateTime = `${taskDueDate}T09:00:00Z`;
    const endDateTime = `${taskDueDate}T10:00:00Z`;

    console.log(`[Google Calendar API] Creating event on primary calendar for "${taskTitle}" (${taskDueDate})...`);

    const eventPayload = {
      summary: `[Echoes Task] ${taskTitle}`,
      description: `Action item extracted by Echoes AI Assistant.\nMeeting: ${meetingName}\nAssignee: ${taskAssignee}\nTask: ${taskTitle}`,
      start: { dateTime: startDateTime, timeZone: 'UTC' },
      end: { dateTime: endDateTime, timeZone: 'UTC' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'email', minutes: 60 },
        ],
      },
    };

    const calendarRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!calendarRes.ok) {
      const errTxt = await calendarRes.text();
      console.error('[Google Calendar API Error]:', errTxt);

      if (calendarRes.status === 401) {
        return NextResponse.json({
          success: false,
          requiresAuth: true,
          authUrl: '/api/calendar/auth',
          error: 'Google Access Token expired. Please re-authorize.',
        }, { status: 401 });
      }

      throw new Error(`Google Calendar API event creation failed (${calendarRes.status}): ${errTxt}`);
    }

    const eventData = await calendarRes.json();
    console.log('[Google Calendar API Success] Event created! Event ID:', eventData.id);

    return NextResponse.json({
      success: true,
      engine: 'Google-Calendar-API-v3-Real',
      eventId: eventData.id,
      htmlLink: eventData.htmlLink,
      summary: eventData.summary,
      start: eventData.start,
      end: eventData.end,
      message: `Google Calendar event successfully created! (ID: ${eventData.id})`,
    });

  } catch (error: any) {
    console.error('[Google Calendar Sync Route Exception]:', error.message);
    return NextResponse.json({
      success: false,
      engine: 'Google-Calendar-Sync-Error',
      error: error.message || 'Calendar sync failed',
    }, { status: 500 });
  }
}
