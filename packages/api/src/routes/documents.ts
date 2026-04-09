import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma, Prisma } from '@zombietech/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLogger';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const uploadDocumentSchema = z.object({
  document_type: z.enum([
    'lease', 'bank_statement', 'utility_bill', 'id_document',
    'proof_of_address', 'food_cert', 'insurance', 'consent_letter',
    'contract_pdf', 'other',
  ]),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().min(1).max(100),
  file_size_bytes: z.number().int().positive(),
  // Base64-encoded file content — in production this would be a multipart/form-data upload
  // For Phase 2 we accept base64 and store to S3 (or stub key in dev)
  file_content_base64: z.string().min(1),
  expires_at: z.string().datetime().optional().nullable(),
});

// ── AI document parser stub ────────────────────────────────────────────────
// Phase 2: returns structured mock data
// Phase 3 will call the real Anthropic Claude API
async function parseDocumentWithAI(
  documentType: string,
  _storageKey: string,
): Promise<{ parsed: boolean; data: Prisma.InputJsonValue }> {
  if (!config.anthropic.apiKey) {
    // Return stub data so the platform works without the key in dev
    return {
      parsed: true,
      data: {
        parsed_at: new Date().toISOString(),
        source: 'stub',
        document_type: documentType,
        extracted: {},
      },
    };
  }

  // Real implementation (Phase 3+):
  // const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
  // const response = await anthropic.messages.create({ ... });
  // Parse structured response...

  return {
    parsed: true,
    data: { parsed_at: new Date().toISOString(), source: 'anthropic', document_type: documentType },
  };
}

// ── S3 upload stub ─────────────────────────────────────────────────────────

async function uploadToStorage(
  base64Content: string,
  fileName: string,
  mimeType: string,
  userId: string,
  documentType: string,
): Promise<{ key: string; url: string }> {
  const timestamp = Date.now();
  const key = `documents/${userId}/${documentType}/${timestamp}_${fileName}`;

  if (!config.aws.accessKeyId) {
    // Dev mode: return a fake key
    return { key, url: `https://dev-storage.zombietech.local/${key}` };
  }

  // Production: upload to S3
  // const s3 = new S3Client({ region: config.aws.region, credentials: { ... } });
  // const buffer = Buffer.from(base64Content, 'base64');
  // await s3.send(new PutObjectCommand({ Bucket: config.aws.s3Bucket, Key: key, Body: buffer, ContentType: mimeType }));
  // const url = `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;

  return { key, url: `https://dev-storage.zombietech.local/${key}` };
}

// ── POST /api/documents/upload ─────────────────────────────────────────────

router.post('/upload', authenticate, validate(uploadDocumentSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof uploadDocumentSchema>;
    const userId = req.user!.id;

    // Compute SHA-256 hash of file content
    const buffer = Buffer.from(body.file_content_base64, 'base64');
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Deduplicate by hash
    const existing = await prisma.document.findFirst({
      where: { owner_user_id: userId, hash },
    });
    if (existing) {
      return res.json({ success: true, data: existing, duplicate: true });
    }

    // Upload to storage
    const { key, url } = await uploadToStorage(
      body.file_content_base64,
      body.file_name,
      body.mime_type,
      userId,
      body.document_type,
    );

    // Parse with AI
    const aiResult = await parseDocumentWithAI(body.document_type, key);

    const document = await prisma.document.create({
      data: {
        owner_user_id: userId,
        document_type: body.document_type,
        storage_key: key,
        file_name: body.file_name,
        mime_type: body.mime_type,
        file_size_bytes: BigInt(body.file_size_bytes),
        hash,
        ai_parsed: aiResult.parsed,
        ai_extracted_data: aiResult.data,
        expires_at: body.expires_at ? new Date(body.expires_at) : null,
      },
    });

    await auditLog(req, 'document.uploaded', 'document', document.id, {
      document_type: body.document_type,
      file_name: body.file_name,
      ai_parsed: aiResult.parsed,
    });

    res.status(201).json({ success: true, data: { ...document, storage_url: url } });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/documents  (current user's documents) ────────────────────────

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type } = req.query as { type?: string };
    const where: Record<string, unknown> = { owner_user_id: req.user!.id };
    if (type) where.document_type = type;

    const documents = await prisma.document.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true, document_type: true, file_name: true, mime_type: true,
        file_size_bytes: true, ai_parsed: true, ai_extracted_data: true,
        expires_at: true, expiry_alerted_at: true, created_at: true,
        // Do not expose storage_key in list — use separate endpoint to get download URL
      },
    });

    res.json({ success: true, data: documents });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/documents/:userId  (admin or self) ────────────────────────────

router.get('/:userId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Only the owner or an admin can access
    if (req.user!.id !== req.params.userId && req.user!.role !== 'admin') {
      throw new AppError(403, 'Access denied', 'FORBIDDEN');
    }

    const documents = await prisma.document.findMany({
      where: { owner_user_id: req.params.userId },
      orderBy: { created_at: 'desc' },
    });

    res.json({ success: true, data: documents });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/documents/:id/download  (generate presigned URL) ─────────────

router.get('/:id/download', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) throw new AppError(404, 'Document not found', 'NOT_FOUND');

    if (doc.owner_user_id !== req.user!.id && req.user!.role !== 'admin') {
      throw new AppError(403, 'Access denied', 'FORBIDDEN');
    }

    // Production: generate presigned S3 URL
    // const cmd = new GetObjectCommand({ Bucket: config.aws.s3Bucket, Key: doc.storage_key });
    // const url = await getSignedUrl(s3Client, cmd, { expiresIn: 300 });

    const url = `https://dev-storage.zombietech.local/${doc.storage_key}?expires=300`;

    res.json({ success: true, data: { download_url: url, expires_in_seconds: 300 } });
  } catch (err) {
    next(err);
  }
});

export default router;
