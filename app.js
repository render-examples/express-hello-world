const express = require('express');
const OpenAI = require('openai');
const { getTrackedImages } = require('./imageStore');
const {
  actionListCampaignGraphics,
  actionCheckAllowedEdits,
  actionEditGraphic,
  actionGenerateBulkGraphics,
} = require('./actions');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const openaiBaseURL = process.env.OPENAI_BASE_URL || undefined;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: openaiBaseURL });

// In-memory conversation history per phone number (last 20 messages kept)
const conversationHistory = new Map();

function getHistory(phoneNumber) {
  return conversationHistory.get(phoneNumber) || [];
}

function appendHistory(phoneNumber, role, content) {
  const history = conversationHistory.get(phoneNumber) || [];
  history.push({ role, content });
  if (history.length > 20) history.shift();
  conversationHistory.set(phoneNumber, history);
}

// ── WhatsApp helpers ─────────────────────────────────────────────────────────

async function whatsappPost(body) {
  const url = `https://graph.facebook.com/v19.0/${whatsappPhoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${whatsappToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WhatsApp API error ${response.status}: ${text}`);
  }
  return response.json();
}

function sendText(to, text) {
  return whatsappPost({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } });
}

function sendImage(to, link) {
  return whatsappPost({ messaging_product: 'whatsapp', to, type: 'image', image: { link } });
}

// ── GPT tool definitions ─────────────────────────────────────────────────────

const tools = [
  {
    type: 'function',
    function: {
      name: 'list_campaign_graphics',
      description: 'List all graphics available in the current campaign',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_for_more_information',
      description: 'Ask the user a clarifying question when the request is ambiguous or incomplete',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The clarifying question to send to the user' },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_allowed_edits',
      description:
        'Check what edits are permitted on a specific graphic. Pick image_id from the "Images previously sent to this user" list in the system prompt that best matches what the user is referring to.',
      parameters: {
        type: 'object',
        properties: {
          image_id: { type: 'string', description: 'The id of the image the user is asking about, from the tracked images list' },
        },
        required: ['image_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_graphic',
      description:
        'Edit a specific graphic via Adobe Express API (e.g. change discount text, colors). Pick image_id from the "Images previously sent to this user" list in the system prompt that best matches what the user is referring to.',
      parameters: {
        type: 'object',
        properties: {
          image_id: { type: 'string', description: 'The id of the image to edit, from the tracked images list' },
          edits: {
            type: 'object',
            description: 'Key-value pairs of edits to apply, e.g. { "discount_text": "70%" }',
          },
        },
        required: ['image_id', 'edits'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_bulk_graphics',
      description: 'Generate multiple graphics from an uploaded CSV or Excel file',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Name of the uploaded CSV or Excel file' },
        },
      },
    },
  },
];

// ── GPT decision engine ──────────────────────────────────────────────────────

async function decideAction(phoneNumber, userMessage) {
  const last3 = getHistory(phoneNumber).slice(-3);
  const trackedImages = getTrackedImages(phoneNumber);
  const imagesList = trackedImages.map((image) => `- ${image.id}: ${image.name}`).join('\n');

  const messages = [
    {
      role: 'system',
      content: `You are a WhatsApp assistant for managing marketing campaign graphics via Adobe Express.
Analyze the user's message and conversation history, then call the appropriate tool.
Always call exactly one tool — never reply with plain text.
If the request is ambiguous or missing details, use ask_for_more_information.

Images previously sent to this user (reference by id):
${imagesList}`,
    },
    ...last3,
    { role: 'user', content: userMessage },
  ];

  console.log(
    `[decideAction] calling chat.completions.create — model: ${openaiModel}, baseURL: ${openai.baseURL}, phone: ${phoneNumber}`
  );

  const response = await openai.chat.completions.create({
    model: openaiModel,
    messages,
    tools,
    tool_choice: 'required',
  });

  return response.choices[0].message;
}

// ── Webhook routes ───────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

app.post('/', async (req, res) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n\nWebhook received ${timestamp}\n`);
  console.log(JSON.stringify(req.body, null, 2));

  res.status(200).end();

  try {
    const messages = req.body?.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages?.length) return;

    for (const message of messages) {
      const userText = message?.text?.body;
      if (!userText) continue;

      const phoneNumber = message.from;
      console.log(`Message from ${phoneNumber}: ${userText}`);

      appendHistory(phoneNumber, 'user', userText);

      const gptMessage = await decideAction(phoneNumber, userText);
      const toolCall = gptMessage.tool_calls?.[0];
      if (!toolCall) continue;

      const action = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}');
      console.log(`GPT chose action: ${action}`, args);

      let replyText;

      switch (action) {
        case 'list_campaign_graphics':
          await sendText(phoneNumber, '⏳ Fetching campaign graphics...');
          replyText = await actionListCampaignGraphics();
          break;

        case 'ask_for_more_information':
          replyText = args.question;
          break;

        case 'check_allowed_edits':
          await sendText(phoneNumber, '⏳ Checking allowed edits...');
          replyText = await actionCheckAllowedEdits(phoneNumber, args.image_id);
          break;

        case 'edit_graphic':
          await sendText(phoneNumber, '⏳ Applying edits to your graphic...');
          replyText = await actionEditGraphic(phoneNumber, args.image_id, args.edits, { sendImage });
          break;

        case 'generate_bulk_graphics':
          await sendText(phoneNumber, '⏳ Generating graphics from your file, this may take a moment...');
          replyText = await actionGenerateBulkGraphics(args.filename);
          break;

        default:
          replyText = "Sorry, I couldn't figure out how to handle that request.";
      }

      await sendText(phoneNumber, replyText);
      appendHistory(phoneNumber, 'assistant', replyText);
    }
  } catch (err) {
    console.error('Error handling message:', {
      message: err.message,
      status: err.status,
      code: err.code,
      type: err.type,
      requestID: err.requestID,
      error: err.error,
      model: openaiModel,
      baseURL: openai.baseURL,
    });
  }
});

app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
  console.log(`[startup] OPENAI_BASE_URL: ${process.env.OPENAI_BASE_URL ?? '(unset, defaults to api.openai.com)'}`);
  console.log(`[startup] OPENAI_MODEL: ${openaiModel}`);
  console.log(`[startup] OPENAI_API_KEY set: ${Boolean(process.env.OPENAI_API_KEY)}`);
});
