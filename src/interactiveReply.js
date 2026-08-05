const EDIT_ID_PREFIX = 'edit:';

// Edit option button/list-row ids are `edit:${imageId}:${fieldName}` (bare field —
// see expressApi.buildEditOptions) or `edit:${imageId}:${encodeURIComponent(JSON.stringify(edits))}`
// (fully-specified — see actions.actionSelectTvModel) — parse either shape back out so
// a tap can tell GPT exactly what to do instead of only the truncated button title.
function buildValueEditId(imageId, edits) {
  return `${EDIT_ID_PREFIX}${imageId}:${encodeURIComponent(JSON.stringify(edits))}`;
}

function parseEditOptionId(id) {
  if (typeof id !== 'string' || !id.startsWith(EDIT_ID_PREFIX)) return null;
  const rest = id.slice(EDIT_ID_PREFIX.length);
  const separatorIndex = rest.indexOf(':');
  if (separatorIndex === -1) return null;
  const imageId = rest.slice(0, separatorIndex);
  const remainder = rest.slice(separatorIndex + 1);

  try {
    const decoded = JSON.parse(decodeURIComponent(remainder));
    if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
      return { imageId, edits: decoded };
    }
  } catch {
    // Not JSON — remainder is a bare field name, handled below.
  }

  return { imageId, fieldName: remainder };
}

function describeEdits(edits) {
  return Object.entries(edits)
    .map(([key, value]) => `"${key}" to "${value}"`)
    .join(', ');
}

function messageTextForInteractiveReply(reply) {
  const parsed = parseEditOptionId(reply.id);
  if (!parsed) return reply.title;
  if (parsed.edits) {
    return `I'd like to change ${describeEdits(parsed.edits)} on image ${parsed.imageId}.`;
  }
  return `I'd like to change "${parsed.fieldName}" on image ${parsed.imageId}.`;
}

module.exports = { buildValueEditId, parseEditOptionId, messageTextForInteractiveReply };
