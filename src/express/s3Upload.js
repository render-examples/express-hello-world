// Downloads a source image and re-hosts it on S3, returning a short-lived
// presigned GET URL. Adobe's generate-variation API only accepts S3, Dropbox,
// or Azure URLs for image tagMappings (see VariationDetails.tagMappings in the
// Express API spec) — CDNs like Scene7 are rejected — so any source image
// coming from elsewhere must be proxied through S3 first.
//
// Ported from the upload_from_url flow in dynamicmedia-autoreflow's
// ImageS3Uploader (Python, git.corp.adobe.com/CQ/dynamicmedia-autoreflow) to
// the AWS SDK for JS v3.
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const DEFAULT_EXPIRES_IN_SECONDS = 1800; // 30 min, matches the Python default
const CACHE_SAFETY_MARGIN_SECONDS = 60;

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// imageUrl+s3Key -> { url, expiresAt } — avoids re-downloading/re-uploading
// and re-signing on every call for a URL that's still valid.
const presignedUrlCache = new Map();

function s3KeyFromUrl(imageUrl) {
  const { pathname } = new URL(imageUrl);
  return pathname.split('/').filter(Boolean).pop() || 'image.jpg';
}

async function uploadFromUrl(imageUrl, { s3Key, expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS } = {}) {
  const bucket = process.env.S3_BUCKET_NAME;
  const key = s3Key || s3KeyFromUrl(imageUrl);
  const cacheKey = `${imageUrl}:${key}`;

  const cached = presignedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image ${imageUrl}: ${response.status}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));

  const presignedUrl = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  });

  const cacheTtlMs = Math.max(expiresInSeconds - CACHE_SAFETY_MARGIN_SECONDS, CACHE_SAFETY_MARGIN_SECONDS) * 1000;
  presignedUrlCache.set(cacheKey, { url: presignedUrl, expiresAt: Date.now() + cacheTtlMs });

  return presignedUrl;
}

module.exports = { uploadFromUrl };
