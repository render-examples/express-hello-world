// Shared presentation helpers for the "allowed edits" summary and the WhatsApp
// quick-reply edit buttons. Pure functions with no I/O — used by BOTH the
// express flow and the local flow, so neither flow has to depend on the other.

function formatAllowedEdits(name, elements, { includeInstruction = true } = {}) {
  const lines = elements.map((element) =>
    element.type === 'text'
      ? `- ${element.name}: currently "${element.value}"`
      : `- ${element.name} (${element.type})`
  );
  let text = `Edits allowed on "${name}":\n${lines.join('\n')}`;
  if (includeInstruction) {
    const example = elements[0]?.name || 'a field';
    text += `\nTell me what you'd like to change and to what, e.g. "change ${example} to ...".`;
  }
  return text;
}

function humanizeFieldName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

// WhatsApp reply-button titles are capped at 20 characters; trim on a word boundary
// rather than cutting mid-word.
function truncateTitle(title, maxLength = 20) {
  if (title.length <= maxLength) return title;
  const truncated = title.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}

function buildEditOptions(elements, imageId) {
  return elements.map((element) => ({
    id: `edit:${imageId}:${element.name}`,
    title: truncateTitle(`Change ${humanizeFieldName(element.name)}`),
  }));
}

module.exports = { formatAllowedEdits, buildEditOptions };
