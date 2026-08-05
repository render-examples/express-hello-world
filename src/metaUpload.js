const { randomUUID } = require('node:crypto');

async function uploadImageToMeta(renderedImageUrl) {
  if (!renderedImageUrl.startsWith('https://mock-express.local/')) {
    return renderedImageUrl;
  }
  return `https://mock-meta-cdn.local/media/${randomUUID()}.png`;
}

module.exports = { uploadImageToMeta };
