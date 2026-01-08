const { google } = require('googleapis');

function parseServiceAccountJson() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_B64 missing');
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }
  const payload = trimmed.replace(/\s+/g, '');
  const decoded = Buffer.from(payload, 'base64').toString('utf8').trim();
  return JSON.parse(decoded);
}

function createCalendarClient() {
  if (!process.env.GOOGLE_CALENDAR_ID) {
    throw new Error('GOOGLE_CALENDAR_ID missing');
  }
  const credentials = parseServiceAccountJson();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
  return google.calendar({ version: 'v3', auth });
}

function assertEventPayload(event) {
  if (!event.summary) {
    throw new Error('Calendar event missing summary');
  }
  if (!event.start || !event.start.dateTime || !event.start.timeZone) {
    throw new Error('Calendar event missing start dateTime/timeZone');
  }
  if (!event.end || !event.end.dateTime || !event.end.timeZone) {
    throw new Error('Calendar event missing end dateTime/timeZone');
  }
  if (!event.extendedProperties || !event.extendedProperties.private?.bookingKey) {
    throw new Error('Calendar event missing bookingKey');
  }
}

async function createBookingEvent(calendar, payload) {
  if (!calendar) {
    throw new Error('Calendar client missing');
  }
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) {
    throw new Error('GOOGLE_CALENDAR_ID missing');
  }
  if (!payload || !payload.bookingKey) {
    throw new Error('Missing bookingKey');
  }
  if (!payload.summary) {
    throw new Error('Missing summary');
  }
  if (!payload.startDateTimeISO) {
    throw new Error('Missing startDateTimeISO');
  }

  const timeZone = process.env.GOOGLE_CALENDAR_TZ || 'Europe/Rome';
  const start = new Date(payload.startDateTimeISO);
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid startDateTimeISO');
  }
  const durationMinutes = Number.isFinite(payload.durationMinutes)
    ? payload.durationMinutes
    : 120;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const event = {
    summary: payload.summary,
    description: payload.description || '',
    start: {
      dateTime: start.toISOString(),
      timeZone
    },
    end: {
      dateTime: end.toISOString(),
      timeZone
    },
    extendedProperties: {
      private: {
        bookingKey: payload.bookingKey
      }
    }
  };

  assertEventPayload(event);

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event
  });
  return response.data;
}

module.exports = {
  createCalendarClient,
  createBookingEvent
};
