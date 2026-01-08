const twilio = require('twilio');

function getTwilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials missing');
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function getVoiceFromNumber() {
  if (process.env.HUMAN_FORWARD_TO) {
    return process.env.HUMAN_FORWARD_TO;
  }
  if (process.env.TWILIO_WHATSAPP_FROM) {
    return process.env.TWILIO_WHATSAPP_FROM.replace('whatsapp:', '');
  }
  return null;
}

async function sendWhatsAppMessage(to, body) {
  if (!process.env.TWILIO_WHATSAPP_FROM) {
    throw new Error('TWILIO_WHATSAPP_FROM missing');
  }
  if (!to) {
    throw new Error('Missing destination number');
  }
  const client = getTwilioClient();
  try {
    return await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
      body
    });
  } catch (error) {
    console.error('Twilio WhatsApp error:', error.code, error.message);
    throw error;
  }
}

async function createOutboundCall(to) {
  if (!process.env.BASE_URL) {
    throw new Error('BASE_URL missing');
  }
  const from = getVoiceFromNumber();
  if (!from) {
    throw new Error('Missing outbound caller ID (set HUMAN_FORWARD_TO or TWILIO_WHATSAPP_FROM)');
  }
  const client = getTwilioClient();
  try {
    return await client.calls.create({
      to,
      from,
      url: `${process.env.BASE_URL}/voice`
    });
  } catch (error) {
    console.error('Twilio call error:', error.code, error.message);
    throw error;
  }
}

module.exports = {
  sendWhatsAppMessage,
  createOutboundCall
};
