const TEMPLATE_LAYERS = {
  tpl_diwali: ['discount_text', 'headline', 'background_color'],
  tpl_summer: ['headline', 'font_color'],
  tpl_croma_earbuds: ['Price', 'Address', 'Product Image', 'Partner Logo'],
};

function getTemplateInfo(templateId) {
  return {
    templateId,
    unlockedLayers: TEMPLATE_LAYERS[templateId] || [],
  };
}

let renderRevision = 0;

function applyEdit(templateId, currentEdits, newEdits) {
  const mergedEdits = { ...currentEdits, ...newEdits };

  if (templateId === 'tpl_croma_earbuds') {
    return {
      mergedEdits,
      renderedImageUrl: 'https://s7ap1.scene7.com/is/image/varun/croma1-earbuds-updated',
    };
  }

  renderRevision += 1;
  return {
    mergedEdits,
    renderedImageUrl: `https://mock-express.local/render/${templateId}?rev=${renderRevision}`,
  };
}

module.exports = { getTemplateInfo, applyEdit };
