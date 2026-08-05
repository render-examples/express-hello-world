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
  buildDiwaliOfferCaption,
  getOfferContext,
} = require('./actions');
const { parseEditOptionId, messageTextForInteractiveReply } = require('./interactiveReply');
const flow2Session = require('./flow2Session');

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

// Active Flow-2 gathering sessions, keyed by phone number. While a session is
// present, inbound messages are handled deterministically by the flow2Session
// state machine (plan → contact → confirm → create) and the LLM is bypassed —
// that's what makes the question sequence deterministic. See flow2Session.js.
const flow2Sessions = new Map();

// Flow 2 (the personalised-offer flow) is gated to a single demo phone number so
// arbitrary inbound numbers can't trigger it — everyone else is restricted to the
// existing behaviour (Flow 1 + generic tools). Substring match, env-overridable.
const FLOW2_PHONE = process.env.FLOW2_PHONE || '9899860983';
function isFlow2Phone(phoneNumber) {
  return String(phoneNumber).includes(FLOW2_PHONE);
}

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// WhatsApp delivers link-image messages a beat after plain text/interactive
// messages (it has to fetch the image before it can display it), so awaiting
// sendImage() isn't enough to guarantee the image lands on-device before a
// message sent right after it. This pause gives the image a head start so the
// follow-up edit-menu buttons don't arrive first.
const IMAGE_DELIVERY_DELAY_MS = Number(process.env.IMAGE_DELIVERY_DELAY_MS ?? 1800);

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

// ── Flow 2 deterministic sequence executor ───────────────────────────────────

// Execute a descriptor returned by flow2Session (ask/reask a question, or create
// the design). Keeps all the WhatsApp side effects here; flow2Session stays pure.
async function runFlow2Action(phoneNumber, action) {
  if (!action) return;
  if (action.type === 'ask' || action.type === 'reask') {
    await sendQuickReplies(phoneNumber, action.question, action.options);
    appendHistory(phoneNumber, 'assistant', action.question);
    return;
  }
  if (action.type === 'create') {
    console.log('[flow2] create_design (deterministic)', action.args);
    const result = await actionCreateDesign(phoneNumber, action.args, { sendImage, sendText });
    if (typeof result === 'string') {
      // Error path — the flow couldn't send the image, so surface the message.
      await sendText(phoneNumber, result);
      appendHistory(phoneNumber, 'assistant', result);
    } else {
      // Success — image + caption already sent by the flow.
      appendHistory(phoneNumber, 'assistant', result.historyText);
    }
  }
}

// Handle one inbound message while a Flow-2 session is active. Fully deterministic:
// no LLM call — the answer is fuzzy-matched and the state machine picks the next step.
async function handleFlow2Turn(phoneNumber, userText) {
  const { plans } = getOfferContext();
  const session = flow2Sessions.get(phoneNumber);
  const { state, action } = flow2Session.advance(session, userText, { plans });
  if (state) flow2Sessions.set(phoneNumber, state);
  else flow2Sessions.delete(phoneNumber);
  await runFlow2Action(phoneNumber, action);
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
        'Signal that the user wants a brand-new PERSONALISED offer creative for a specific customer (e.g. a personalised car-insurance offer for a customer who test drove a model). Call this as SOON as you recognise that intent, passing only customer and model. The system then gathers the plan and contact details with tappable buttons and drives the rest of the sequence — so do NOT pass plan or includeContact, and do NOT ask any questions first. Do NOT use this for bulk generation from a CSV/Excel file — that is generate_bulk_graphics.',
      parameters: {
        type: 'object',
        properties: {
          customer: { type: 'string', description: "The customer's name, e.g. \"Apoorva\"" },
          model: { type: 'string', description: "The vehicle/product the customer is interested in, e.g. \"Grand Vitara\"" },
        },
        required: [],
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

  // Note: the personalised-offer plan picker is no longer driven from this prompt —
  // the deterministic Flow-2 state machine (flow2Session.js) asks for the plan with
  // tappable buttons after create_design fires, so the plans list isn't needed here.

  const messages = [
    {
      role: 'system',
      content: `You are a WhatsApp assistant for managing marketing campaign graphics via Adobe Express.
Analyze the user's message and conversation history, then call the appropriate tool.
Always call exactly one tool — never reply with plain text.
If the request is ambiguous or missing details, use ask_for_more_information.
If the user says which field they want to change but hasn't given the new value yet, call ask_for_more_information to ask what to change it to. If a later message in the conversation then supplies that value, call edit_graphic with the field and value instead of asking again.
Creating a personalised customer offer (create_design) — this is for a car-dealership salesman making an on-brand offer to send to a specific customer (e.g. "Apoorva test drove the Grand Vitara and asked about insurance — make her a personalised offer"). The message may contain typos.
- As SOON as you recognise this intent, call create_design immediately, passing only the customer's name and the model you can extract from the conversation. If either is unclear, still call create_design with whatever you have (or leave it blank).
- Do NOT ask about the plan, the contact, or "anything else" yourself, and do NOT call ask_for_more_information for this flow — the system gathers the plan and contact with tappable buttons and drives the rest of the sequence deterministically after create_design is called. Never pass plan or includeContact yourself.
- To translate the offer to another language (e.g. "make it in Hindi"), call edit_graphic — the offer is available in English and Hindi.
Choosing between edit_graphic and check_allowed_edits: if the user's message already contains a concrete change and its value (e.g. "make the background marigold", "add my address MG Road Kochi"), call edit_graphic with all of those changes in the edits object. Only call check_allowed_edits when the user asks what can be changed or wants the list of options WITHOUT giving a specific value.
When editing, prefer these field names when they apply: headline, background, address, offer.
If the user asks to translate a tag's text into another language (e.g. "change the headline to Hindi", "translate the banner to Malayalam"), translate the current text yourself before calling edit_graphic and pass the translated text as the edit value. For Hindi, use Devanagari script (e.g. "उपलब्ध"); for Malayalam, use Malayalam script (e.g. "ഓണം"). Never use a romanized/transliterated form.
When the user taps a menu option for "product", "discount", or "price" (from the fixed Edit Product/Edit Discount/Edit Price menu on an Express-catalog graphic):
- "product": call select_tv_model.
- "discount" or "price" with no value given yet: call ask_for_more_information asking what they'd like the new discount or price to be.
- "discount" WITH a value (a percentage, in English, Hindi, or Hinglish — e.g. "50%", "discount ko 50% kar do", "40% off"): compute the new price yourself as oldPrice × (1 − discountPercent / 100), rounded to the nearest whole number, using the oldPrice shown in the images list below, then call edit_graphic with { "price": <computed value>, "discountPercentage": "<discountPercent>%" } — never change oldPrice.
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

      // Flow 2 is gated to the demo phone. On that phone, a fresh "create a
      // personalised offer" message (fuzzy-matched, typo-tolerant) (re)starts the
      // gathering session from step 1 — checked BEFORE the in-progress bypass so a
      // re-prompt always restarts rather than being read as an answer.
      if (isFlow2Phone(phoneNumber) && flow2Session.isCreateOfferIntent(userText)) {
        const { plans, defaults, models } = getOfferContext();
        const offerArgs = flow2Session.extractOffer(userText, { defaults, models });
        const { state, action } = flow2Session.start(offerArgs, { plans });
        flow2Sessions.set(phoneNumber, state);
        console.log('[flow2] (re)start via fuzzy trigger', offerArgs);
        await runFlow2Action(phoneNumber, action);
        continue;
      }

      // Flow-2 gathering in progress → drive it deterministically, skip the LLM.
      if (flow2Sessions.has(phoneNumber)) {
        await handleFlow2Turn(phoneNumber, userText);
        continue;
      }

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
          // Fallback Flow-2 entry: the deterministic fuzzy trigger above catches
          // most create requests before the LLM runs, but this handles phrasings it
          // missed. Gated to the demo phone — other numbers are restricted to the
          // current behaviour, so a stray create_design there is politely declined.
          if (!isFlow2Phone(phoneNumber)) {
            replyText = "I can help you update your existing campaign graphics — tell me what you'd like to change.";
            break;
          }
          // The LLM only DETECTS intent + extracts customer/model; it never creates
          // directly. Starting a session hands sequencing to the deterministic state
          // machine (plan → contact → confirm, fuzzy-matched) before create_design
          // ever runs — the model can't skip the questions.
          const { plans, defaults } = getOfferContext();
          const startArgs = { customer: args.customer || defaults.customer, model: args.model || defaults.model };
          const { state, action } = flow2Session.start(startArgs, { plans });
          flow2Sessions.set(phoneNumber, state);
          await runFlow2Action(phoneNumber, action);
          skipSend = true;
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
          // outcomes are always a structured {status, ...} object. On success,
          // the image is delivered with the fixed Diwali-offer caption (updated
          // price baked in); other statuses are phrased to match the user's
          // language. Either way, the fixed Edit Product/Discount/Price menu
          // follows — after a short pause so it can't arrive before the image.
          const result = await actionEditGraphic(phoneNumber, args.image_id, args.edits, { sendImage, sendText });
          if (typeof result === 'string') {
            replyText = result;
          } else if (result.status) {
            if (result.status === 'success') {
              replyText = buildDiwaliOfferCaption(result);
              try {
                await sendImage(phoneNumber, result.thumbnailUrl, replyText);
                await sleep(IMAGE_DELIVERY_DELAY_MS);
              } catch (err) {
                console.error('[edit_graphic] sendImage error', { message: err.message });
                replyText = `Updated "${result.productName}", but I couldn't send the image right now — try asking me to resend it.`;
                await sendText(phoneNumber, replyText);
              }
            } else {
              replyText = await phraseOutcome(phoneNumber, userText, result);
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
