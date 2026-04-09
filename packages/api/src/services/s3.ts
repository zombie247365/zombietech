import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { config } from '../config';

// ── Client ────────────────────────────────────────────────────────────────────

let _s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: config.aws.region,
      credentials: config.aws.accessKeyId
        ? {
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey,
          }
        : undefined, // will use instance role / env chain in prod
    });
  }
  return _s3Client;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UploadResult {
  key: string;
  url: string;
  hash: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 of a Buffer and return hex string.
 */
export function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ── Upload ────────────────────────────────────────────────────────────────────

/**
 * Upload a file buffer to S3 (or stub in dev when no credentials).
 *
 * @param buffer   Raw file bytes
 * @param key      Full S3 object key (e.g. "photos/sessions/abc/before/xxx.jpg")
 * @param mimeType MIME type for Content-Type header
 */
export async function uploadToS3(
  buffer: Buffer,
  key: string,
  mimeType: string,
): Promise<UploadResult> {
  const hash = sha256(buffer);

  if (!config.aws.accessKeyId) {
    // Dev stub — no actual S3 upload
    const url = `https://dev-s3.zombietech.local/${config.aws.s3Bucket}/${key}`;
    return { key, url, hash };
  }

  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ServerSideEncryption: 'AES256',
      Metadata: {
        'x-content-hash': hash,
      },
    }),
  );

  const url = `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
  return { key, url, hash };
}

// ── Presigned download URL ─────────────────────────────────────────────────

/**
 * Generate a short-lived presigned GET URL (default 5 minutes).
 */
export async function presignedGetUrl(key: string, expiresInSeconds = 300): Promise<string> {
  if (!config.aws.accessKeyId) {
    return `https://dev-s3.zombietech.local/${config.aws.s3Bucket}/${key}?expires=${expiresInSeconds}`;
  }

  const client = getClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: config.aws.s3Bucket, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

// ── Delete (admin only) ───────────────────────────────────────────────────────

export async function deleteFromS3(key: string): Promise<void> {
  if (!config.aws.accessKeyId) return; // dev no-op

  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: config.aws.s3Bucket, Key: key }));
}

// ── Key builders ──────────────────────────────────────────────────────────────

export function photoKey(
  sessionId: string,
  checklistItemId: string,
  photoType: 'before' | 'after' | 'lockup',
  originalFileName: string,
): string {
  const ext = originalFileName.split('.').pop() ?? 'jpg';
  const ts = Date.now();
  return `photos/sessions/${sessionId}/${photoType}/${checklistItemId}_${ts}.${ext}`;
}

export function documentKey(
  userId: string,
  documentType: string,
  originalFileName: string,
): string {
  const ext = originalFileName.split('.').pop() ?? 'pdf';
  const ts = Date.now();
  return `documents/${userId}/${documentType}/${ts}_${originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`;
}
