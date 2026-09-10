import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2, spoken to over the S3 API — same SDK works unmodified if
// this ever needs to move to real S3. OnchainOS doesn't provide file
// storage, so downloadable letters/reports need a bucket of our own.
//
// Chosen over plain S3 for cost (no egress fees, which matters for a
// pay-per-call agent service where every letter download is a request)
// and because setup is one API token, no IAM policy authoring.

const REQUIRED = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];
const LINK_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days — long enough to forward to an employer/insurer, short enough not to be a permanent public leak of a health document.

let client = null;

export function isStorageConfigured() {
  return REQUIRED.every((key) => !!process.env[key]);
}

function getClient() {
  if (client) return client;
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Storage not configured. Set ${missing.join(", ")}.`);
  }
  client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

/**
 * Uploads a buffer and returns a signed, time-limited download URL.
 * @param {Buffer} buffer
 * @param {string} key e.g. "reports/{userId}/{reportId}.pdf"
 * @param {string} contentType
 * @returns {Promise<{ url: string, expiresAt: string }>}
 */
export async function uploadAndGetLink(buffer, key, contentType = "application/pdf") {
  const s3 = getClient();
  const bucket = process.env.R2_BUCKET_NAME;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: LINK_TTL_SECONDS,
  });

  return { url, expiresAt: new Date(Date.now() + LINK_TTL_SECONDS * 1000).toISOString() };
}
