const express = require('express');
const { twiml: TwilioTwiml } = require('twilio');

const MAX_RETRIES = 2;
const STEPS = [
  { key: 'name', prompt: 'Ciao! Come ti chiami?' },
  { key: 'date', prompt: 'Per quale giorno vuoi prenotare?' },
  { key: 'time', prompt: 'A che ora?' },
  { key: 'people', prompt: 'Per quante persone?' }
];

function buildGather(prompt) {
  const response = new TwilioTwiml.VoiceResponse();
  const gather = response.gather({
    input: 'speech',
    language: 'it-IT',
    speechTimeout: 'auto',
    action: '/voice/step',
    method: 'POST'
  });
  gather.say({ language: 'it-IT' }, prompt);
  response.say({ language: 'it-IT' }, 'Non ho ricevuto risposta. Riproviamo.');
  response.redirect({ method: 'POST' }, '/voice');
  return response;
}

function buildTransfer() {
  const response = new TwilioTwiml.VoiceResponse();
  if (process.env.HUMAN_FORWARD_TO) {
    response.say({ language: 'it-IT' }, 'Ti trasferisco a un operatore.');
    response.dial({}, process.env.HUMAN_FORWARD_TO);
  } else {
    response.say(
      { language: 'it-IT' },
      'Spiacente, c’è un problema tecnico. Riprova più tardi.'
    );
  }
  return response;
}

function normalizeDateInput(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function normalizeTimeInput(value) {
  if (!value) return null;
  const match = value.match(/(\d{1,2})[:.]?(\d{2})?/);
  if (!match) return null;
  const hours = match[1].padStart(2, '0');
  const minutes = (match[2] || '00').padStart(2, '0');
  return `${hours}:${minutes}`;
}

function normalizePeopleInput(value) {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function ensureSession(store, callSid) {
  if (!store.has(callSid)) {
    store.set(callSid, { stepIndex: 0, attempts: 0, data: {} });
  }
  return store.get(callSid);
}

function isComplete(data) {
  return data.name && data.date && data.time && data.people;
}

function buildStartDateTimeISO(dateISO, time24) {
  if (!dateISO || !time24) return null;
  const dateTime = new Date(`${dateISO}T${time24}:00`);
  if (Number.isNaN(dateTime.getTime())) {
    return null;
  }
  return dateTime.toISOString();
}

function createVoiceRouter({ createCalendarClient, createBookingEvent }) {
  const router = express.Router();
  const sessions = new Map();

  router.post('/voice', (req, res) => {
    const callSid = req.body.CallSid || 'unknown';
    const session = ensureSession(sessions, callSid);
    const step = STEPS[session.stepIndex];
    const response = buildGather(step.prompt);
    res.type('text/xml').send(response.toString());
  });

  router.post('/voice/step', async (req, res) => {
    const callSid = req.body.CallSid || 'unknown';
    const speechResult = (req.body.SpeechResult || '').trim();
    const session = ensureSession(sessions, callSid);

    if (!speechResult) {
      session.attempts += 1;
      if (session.attempts > MAX_RETRIES) {
        const transfer = buildTransfer();
        sessions.delete(callSid);
        return res.type('text/xml').send(transfer.toString());
      }
      const retry = buildGather('Non ho capito, puoi ripetere?');
      return res.type('text/xml').send(retry.toString());
    }

    const step = STEPS[session.stepIndex];
    let value = speechResult;
    if (step.key === 'date') value = normalizeDateInput(speechResult);
    if (step.key === 'time') value = normalizeTimeInput(speechResult);
    if (step.key === 'people') value = normalizePeopleInput(speechResult);

    if (!value) {
      session.attempts += 1;
      const retry = buildGather(`Non ho capito. ${step.prompt}`);
      return res.type('text/xml').send(retry.toString());
    }

    session.data[step.key] = value;
    session.stepIndex += 1;
    session.attempts = 0;

    if (!isComplete(session.data)) {
      const nextStep = STEPS[session.stepIndex];
      const response = buildGather(nextStep.prompt);
      return res.type('text/xml').send(response.toString());
    }

    const response = new TwilioTwiml.VoiceResponse();
    response.say({ language: 'it-IT' }, 'Perfetto, riepilogo la prenotazione.');
    response.say(
      { language: 'it-IT' },
      `Nome ${session.data.name}, data ${session.data.date}, ora ${session.data.time}, per ${session.data.people} persone.`
    );

    try {
      const calendar = createCalendarClient();
      const startDateTimeISO = buildStartDateTimeISO(session.data.date, session.data.time);
      if (!startDateTimeISO) {
        throw new Error('Data o orario non validi');
      }

      await createBookingEvent(calendar, {
        bookingKey: callSid,
        summary: `Prenotazione ${session.data.name}`,
        description: `Prenotazione per ${session.data.people} persone`,
        startDateTimeISO,
        durationMinutes: 120
      });

      response.say({ language: 'it-IT' }, 'Prenotazione confermata. A presto!');
    } catch (error) {
      console.error('VOICE FLOW ERROR:', error);
      response.say(
        { language: 'it-IT' },
        'C’è un problema tecnico con il calendario. Per favore, contatta un operatore.'
      );
      const transfer = buildTransfer();
      return res.type('text/xml').send(transfer.toString());
    }

    sessions.delete(callSid);
    return res.type('text/xml').send(response.toString());
  });

  return router;
}

module.exports = {
  createVoiceRouter
};
