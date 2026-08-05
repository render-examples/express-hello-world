#!/usr/bin/env bash
# Drives the personalised automobile-insurance offer flow (Flow 2) against a
# running webhook, one step at a time. Watch the server logs for `GPT chose
# action:` and `[edit:local] resolved image`.
#
# Usage:  bash demo-auto-flow.sh
#         BASE_URL=http://localhost:3000 PHONE=919899860983 bash demo-auto-flow.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PHONE="${PHONE:-919899860983}"
PAUSE="${PAUSE:-10}"
GEN_PAUSE="${GEN_PAUSE:-30}"

# Send a free-text WhatsApp message.
send() {
  echo ">>> [text] $1"
  curl -s -X POST "$BASE_URL/" -H 'Content-Type: application/json' -d "$(cat <<JSON
{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"messages":[
{"from":"$PHONE","type":"text","text":{"body":"$1"}}]}}]}]}
JSON
)" >/dev/null
  echo "    (200 ack — check server logs)"
  echo
}

# Tap a reply button (WhatsApp interactive button_reply). Arg = button title.
tap() {
  echo ">>> [tap button] $1"
  curl -s -X POST "$BASE_URL/" -H 'Content-Type: application/json' -d "$(cat <<JSON
{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"messages":[
{"from":"$PHONE","type":"interactive","interactive":{"type":"button_reply","button_reply":{"id":"qr:$1","title":"$1"}}}]}}]}]}
JSON
)" >/dev/null
  echo "    (200 ack — check server logs)"
  echo
}

echo "=== WhatsCraft personalised auto-insurance offer flow → $BASE_URL  (phone: $PHONE) ==="
echo

# 1) Salesman asks for a personalised offer → WC asks which HQ-approved plan [buttons]
send "Apoorva test drove the Grand Vitara yesterday and asked for insurance options. Create a personalised offer for her."
sleep "$PAUSE"

# 2) Pick the plan → WC asks whether to add the salesman's contact [Yes/No]
tap "3-Yr Comprehensive"
sleep "$PAUSE"

# 3) Yes to contact → WC asks "anything else?" [Yes / No, go ahead]
tap "✅ Yes"
sleep "$PAUSE"

# 4) Nothing else → WC streams progress for a few seconds, then sends the English banner.
#    Wait for that generation to finish before the next step so messages don't interleave.
tap "➡️ No, go ahead"
echo "... waiting ${GEN_PAUSE}s for generation to stream + finish ..."
sleep "$GEN_PAUSE"

# 5) Translate → WC streams briefly, then sends the Hindi banner
send "make it in Hindi"

echo "=== done — verify the two banners (English + Hindi) on WhatsApp and the tool choices in the logs ==="
