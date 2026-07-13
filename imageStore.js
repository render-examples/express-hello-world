const SEED_IMAGES = [
  { id: 'img_1', name: 'Diwali Offer Banner', templateId: 'tpl_diwali' },
  { id: 'img_2', name: 'Summer Sale Flyer', templateId: 'tpl_summer' },
  {
    id: 'img_3',
    name: 'Croma Earbuds',
    templateId: 'tpl_croma_earbuds',
    url: 'https://s7ap1.scene7.com/is/image/varun/croma1-earbuds',
  },
];

const trackedImages = new Map();

function getTrackedImages(phoneNumber) {
  if (!trackedImages.has(phoneNumber)) {
    trackedImages.set(
      phoneNumber,
      SEED_IMAGES.map((image) => ({ ...image, currentEdits: {} }))
    );
  }
  return trackedImages.get(phoneNumber);
}

function findTrackedImage(phoneNumber, imageId) {
  return getTrackedImages(phoneNumber).find((image) => image.id === imageId);
}

module.exports = { getTrackedImages, findTrackedImage };
