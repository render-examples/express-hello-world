const express = require('express');
const OpenAI = require('openai');
const { getTrackedImages } = require('./imageStore');
const {
  actionListCampaignGraphics,
  actionCreateDesign,
  actionCheckAllowedEdits,
  actionEditGraphic,
  actionGenerateBulkGraphics,
  actionSelectTvModel,
  buildTopLevelEditOptions,
} = require('./actions');
const { parseEditOptionId, messageTextForInteractiveReply } = require('./interactiveReply');

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

function sendImage(to, link, caption) {
  const image = caption ? { link, caption } : { link };
  return whatsappPost({ messaging_product: 'whatsapp', to, type: 'image', image });
}

// WhatsApp reply-button messages support at most 3 buttons.
function sendButtons(to, bodyText, options) {
  return whatsappPost({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: options.map((option) => ({ type: 'reply', reply: { id: option.id, title: option.title } })),
      },
    },
  });
}

// WhatsApp list messages: a single "menu" button plus up to 10 rows in one section.
function sendList(to, { bodyText, buttonText, options }) {
  return whatsappPost({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections: [{ rows: options.map((option) => ({ id: option.id, title: option.title })) }],
      },
    },
  });
}

// WhatsApp reply-button messages cap out at 3 buttons, so options beyond that
// go out as additional button messages rather than falling back to a list picker.
const BUTTONS_PER_MESSAGE = 3;

async function sendEditOptions(to, result) {
  const { bodyText, options, buttonText } = result;
  if (options.length === 0) {
    await sendText(to, bodyText);
    return;
  }
  if (buttonText) {
    await sendList(to, { bodyText, buttonText, options });
    return;
  }
  for (let i = 0; i < options.length; i += BUTTONS_PER_MESSAGE) {
    const chunk = options.slice(i, i + BUTTONS_PER_MESSAGE);
    await sendButtons(to, i === 0 ? bodyText : 'More edits:', chunk);
  }
}

// Follow-up yes/no (or short multiple-choice) questions rendered as tappable
// buttons. The tapped title flows back as the user's text (see interactiveReply).
function sendQuickReplies(to, question, options) {
  const buttons = options.slice(0, BUTTONS_PER_MESSAGE).map((label) => ({ id: `qr:${label}`, title: label }));
  return sendButtons(to, question, buttons);
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
      name: 'create_design',
      description:
        'Create a brand-new single marketing creative from a text description, for an occasion or theme that has NO existing template (e.g. Onam, Pongal). Use when the user wants to make/create/design a new banner or creative from scratch. Do NOT use this for bulk generation from a CSV/Excel file — that is generate_bulk_graphics.',
      parameters: {
        type: 'object',
        properties: {
          occasion: { type: 'string', description: 'The occasion or theme, e.g. "Onam"' },
          products: {
            type: 'array',
            items: { type: 'string' },
            description: 'Products to feature, e.g. ["LG washing machine", "dishwasher"]',
          },
          offer: { type: 'string', description: 'The offer or discount to show, e.g. "20% off"' },
          includeAddress: {
            type: 'boolean',
            description: "Set true if the user has agreed to include their store address on the design; otherwise false.",
          },
        },
        required: ['occasion'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_for_more_information',
      description: 'Ask the user a clarifying question when the request is ambiguous or incomplete. For yes/no or short multiple-choice questions, pass options so the user gets tappable buttons instead of typing.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The clarifying question to send to the user' },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional short answer choices to render as tappable buttons, e.g. ["Yes","No"] (max 3).',
          },
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
        'Show the list of fields the user CAN edit on a graphic. Use this ONLY when the user asks what can be changed / wants the options (e.g. "what can I edit?", "edit", "make changes") and does NOT give a specific new value. If the user already states a change and its value, use edit_graphic instead. Pick image_id from the "Images previously sent to this user" list in the system prompt that best matches what the user is referring to.',
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
      name: 'select_tv_model',
      description:
        'Use when the user asks to change or set the product in a graphic to a TV, without specifying which model. Do not use this for edits to text fields or other product types — use edit_graphic for those.',
      parameters: {
        type: 'object',
        properties: {
          image_id: { type: 'string', description: 'The id of the image to edit, from the tracked images list' },
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
        'Apply one or more concrete edits to a specific graphic. Use this WHENEVER the user states what to change AND the new value — e.g. "make the background marigold", "add my address MG Road Kochi", "change the offer to 7500", "translate the banner to Malayalam". Put every requested change into the edits object (multiple keys allowed). Pick image_id from the "Images previously sent to this user" list in the system prompt that best matches what the user is referring to. If the user asks to translate a tag\'s text into another language, translate it yourself and pass the translated string as the edit value — for Hindi always use Devanagari script (e.g. "उपलब्ध"), for Malayalam always use Malayalam script (e.g. "ഓണം"), never a romanized transliteration.',
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

function formatCurrentEdits(currentEdits) {
  const entries = Object.entries(currentEdits || {});
  if (entries.length === 0) return '';
  return ` (${entries.map(([key, value]) => `${key}: ${value}`).join(', ')})`;
}

async function decideAction(phoneNumber, userMessage) {
  // Keep a wide window so multi-step flows (e.g. "design X" → "Onam? yes" →
  // "address? yes" → create) still see the original product/offer request.
  const recentHistory = getHistory(phoneNumber).slice(-12);
  const trackedImages = getTrackedImages(phoneNumber);
  const imagesList = trackedImages
    .map((image) => `- ${image.id}: ${image.name}${formatCurrentEdits(image.currentEdits)}`)
    .join('\n');

  const messages = [
    {
      role: 'system',
      content: `You are a WhatsApp assistant for managing marketing campaign graphics via Adobe Express.
Analyze the user's message and conversation history, then call the appropriate tool.
Always call exactly one tool — never reply with plain text.
If the request is ambiguous or missing details, use ask_for_more_information.
If the user says which field they want to change but hasn't given the new value yet, call ask_for_more_information to ask what to change it to. If a later message in the conversation then supplies that value, call edit_graphic with the field and value instead of asking again.
Creating a brand-new design (create_design), gather details first with tappable buttons:
- If the user asks for a design but does NOT mention an occasion/festival, first call ask_for_more_information with options ["Yes","No"] to suggest Onam, e.g. "This is a great time for an Onam offer — want me to generate this for Onam?".
- Once an occasion is agreed (or was given up front), and before creating, call ask_for_more_information with options ["Yes","No"] to ask "Great! Do you also want to add your store address?".
- Then call create_design with the occasion, the products and offer mentioned earlier in the conversation, and includeAddress set from their address answer.
- Always attach options ["Yes","No"] to any yes/no question so the user can tap a button instead of typing.
- After the design is sent, if the user asks to change something (e.g. "change the language to Malayalam"), call edit_graphic.
Choosing between edit_graphic and check_allowed_edits: if the user's message already contains a concrete change and its value (e.g. "make the background marigold", "add my address MG Road Kochi"), call edit_graphic with all of those changes in the edits object. Only call check_allowed_edits when the user asks what can be changed or wants the list of options WITHOUT giving a specific value.
When editing, prefer these field names when they apply: headline, background, address, offer.
If the user asks to translate a tag's text into another language (e.g. "change the headline to Hindi", "translate the banner to Malayalam"), translate the current text yourself before calling edit_graphic and pass the translated text as the edit value. For Hindi, use Devanagari script (e.g. "उपलब्ध"); for Malayalam, use Malayalam script (e.g. "ഓണം"). Never use a romanized/transliterated form.
When the user taps a menu option for "product", "discount", or "price" (from the fixed Edit Product/Edit Discount/Edit Price menu on an Express-catalog graphic):
- "product": call select_tv_model.
- "discount" or "price" with no value given yet: call ask_for_more_information asking what they'd like the new discount or price to be.
- "discount" WITH a value (a percentage, in English, Hindi, or Hinglish — e.g. "50%", "discount ko 50% kar do", "40% off"): compute the new price yourself as oldPrice × (1 − discountPercent / 100), rounded to the nearest whole number, using the oldPrice shown in the images list below, then call edit_graphic with only { "price": <computed value> } — never change oldPrice.
- "price" WITH a value: call edit_graphic with { "price": <value> } directly, no computation needed.

Images previously sent to this user (reference by id):
${imagesList}`,
    },
    ...recentHistory,
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

// Turns a structured edit outcome into the actual WhatsApp reply text, matching
// the user's language/style (English or Hinglish) rather than a fixed template.
async function phraseOutcome(phoneNumber, userMessage, outcome) {
  const response = await openai.chat.completions.create({
    model: openaiModel,
    messages: [
      {
        role: 'system',
        content: `You are a WhatsApp assistant. Given the outcome below, write a short reply to the user. Match the user's language and style — if their message was Hinglish (romanized Hindi mixed with English), reply in Hinglish; otherwise reply in English. Don't invent facts beyond the outcome given.

Examples of the tone/style to match:
- Success (English): "I have updated product, with price & discount"
- Success (Hinglish): "Maine discount aur price updated kar diya hai"
- Capped (Hinglish): "Iss product pr maximum 40% discount de sakte hain"`,
      },
      { role: 'user', content: `User message: ${userMessage}\nOutcome: ${JSON.stringify(outcome)}` },
    ],
  });

  return response.choices[0].message.content;
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
      if (message.context) console.log('[webhook] message.context:', JSON.stringify(message.context));
      if (message.referral) console.log('[webhook] message.referral:', JSON.stringify(message.referral));
      if (message.image) console.log('[webhook] message.image:', JSON.stringify(message.image));

      const interactiveReply = message?.interactive?.button_reply || message?.interactive?.list_reply;
      const userText = message?.text?.body || (interactiveReply && messageTextForInteractiveReply(interactiveReply));
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
      let skipSend = false;

      switch (action) {
        case 'list_campaign_graphics':
          await sendText(phoneNumber, '⏳ Fetching campaign graphics...');
          replyText = await actionListCampaignGraphics();
          break;

        case 'create_design': {
          // Progress is streamed from inside the flow (with the product/offer context).
          // On success the flow already sent the image+caption, so skip the extra text.
          const result = await actionCreateDesign(phoneNumber, args, { sendImage, sendText });
          if (typeof result === 'string') {
            replyText = result;
          } else {
            replyText = result.historyText;
            skipSend = true;
          }
          break;
        }

        case 'ask_for_more_information':
          console.log('[action:ask_for_more_information]', { question: args.question, options: args.options });
          if (Array.isArray(args.options) && args.options.length > 0) {
            await sendQuickReplies(phoneNumber, args.question, args.options);
            replyText = args.question; // kept for conversation history
            skipSend = true;
          } else {
            replyText = args.question;
          }
          break;

        case 'check_allowed_edits': {
          await sendText(phoneNumber, '⏳ Checking allowed edits...');
          const result = await actionCheckAllowedEdits(phoneNumber, args.image_id);
          if (typeof result === 'string') {
            replyText = result;
          } else {
            await sendEditOptions(phoneNumber, result);
            replyText = result.historyText;
            skipSend = true;
          }
          break;
        }

        case 'select_tv_model': {
          const result = actionSelectTvModel(args.image_id);
          await sendEditOptions(phoneNumber, result);
          replyText = result.bodyText;
          skipSend = true;
          break;
        }

        case 'edit_graphic': {
          // Progress is streamed from inside the flow. Local-flow outcomes are
          // either a plain string (guardrail rejection) or {skipSend:true,
          // historyText} (success, image+caption already sent). Express-flow
          // outcomes are always a structured {status, ...} object — phrased here
          // to match the user's language, delivered with that phrasing as the
          // image caption, then followed by the fixed Edit Product/Discount/Price menu.
          const result = await actionEditGraphic(phoneNumber, args.image_id, args.edits, { sendImage, sendText });
          if (typeof result === 'string') {
            replyText = result;
          } else if (result.status) {
            replyText = await phraseOutcome(phoneNumber, userText, result);
            if (result.status === 'success') {
              try {
                await sendImage(phoneNumber, result.thumbnailUrl, replyText);
              } catch (err) {
                console.error('[edit_graphic] sendImage error', { message: err.message });
                replyText = `Updated "${result.productName}", but I couldn't send the image right now — try asking me to resend it.`;
                await sendText(phoneNumber, replyText);
              }
            } else {
              await sendText(phoneNumber, replyText);
            }
            await sendEditOptions(phoneNumber, buildTopLevelEditOptions(args.image_id));
            skipSend = true;
          } else {
            replyText = result.historyText;
            skipSend = true;
          }
          break;
        }

        case 'generate_bulk_graphics':
          await sendText(phoneNumber, '⏳ Generating graphics from your file, this may take a moment...');
          replyText = await actionGenerateBulkGraphics(args.filename);
          break;

        default:
          replyText = "Sorry, I couldn't figure out how to handle that request.";
      }

      if (!skipSend) {
        await sendText(phoneNumber, replyText);
      }
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
