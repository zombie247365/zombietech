import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@zombietech/database';
import { config } from '../config';
import { presignedGetUrl } from './s3';

// ── Anthropic client (lazy) ───────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return _anthropic;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComparisonResult {
  ai_result: 'clean' | 'flagged' | 'inconclusive';
  ai_confidence: number; // 0.00–100.00
  ai_description: string;
}

// ── Stub result (when no API key) ─────────────────────────────────────────────

function stubResult(areaName: string): ComparisonResult {
  return {
    ai_result: 'clean',
    ai_confidence: 85.0,
    ai_description: `[DEV STUB] No Anthropic API key configured. Area "${areaName}" assumed clean for development.`,
  };
}

// ── Core comparison ───────────────────────────────────────────────────────────

/**
 * Compare a before and after photo for a single checklist area using Claude vision.
 *
 * Sends both images to Claude claude-sonnet-4-20250514 with a structured prompt asking it to
 * evaluate whether the operator left the area in the same condition they found it.
 *
 * Returns a structured result: clean | flagged | inconclusive, with a confidence
 * score (0-100) and a human-readable description.
 */
export async function comparePhotos(
  beforeStorageKey: string,
  afterStorageKey: string | null,
  areaName: string,
  areaDescription: string,
): Promise<ComparisonResult> {
  if (!afterStorageKey) {
    return {
      ai_result: 'flagged',
      ai_confidence: 95.0,
      ai_description: `No after photo was submitted for "${areaName}". This area could not be verified.`,
    };
  }

  if (!config.anthropic.apiKey) {
    return stubResult(areaName);
  }

  try {
    const [beforeUrl, afterUrl] = await Promise.all([
      presignedGetUrl(beforeStorageKey, 120),
      presignedGetUrl(afterStorageKey, 120),
    ]);

    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a commercial kitchen hygiene and handover inspector for ZombieTech, a platform that rents commercial kitchens to zombie operators during off-hours.

You are comparing two photos of the same area taken before and after an operator used the kitchen. Your task is to determine whether the operator left the area in the same or better condition than they found it.

**Area**: ${areaName}
**Expected condition**: ${areaDescription}

**BEFORE photo** (taken when operator arrived — baseline condition):
**AFTER photo** (taken when operator finished — current condition):

Compare the two photos carefully. Look for:
- Cleanliness differences (stains, grease, food debris)
- Equipment out of place or damaged
- Missing items
- Unreported damage
- General tidiness

Respond ONLY with valid JSON in this exact format:
{
  "result": "clean" | "flagged" | "inconclusive",
  "confidence": <number 0-100>,
  "description": "<1-3 sentence explanation of your finding>"
}

"clean" = area is in same or better condition
"flagged" = area is in worse condition or something is missing/damaged
"inconclusive" = photos too unclear/dark/blurry to make a determination`,
            },
            {
              type: 'image',
              source: { type: 'url', url: beforeUrl },
            },
            {
              type: 'image',
              source: { type: 'url', url: afterUrl },
            },
          ],
        },
      ],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from the response (Claude sometimes adds commentary)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      result: string;
      confidence: number;
      description: string;
    };

    const validResults = ['clean', 'flagged', 'inconclusive'] as const;
    const result = validResults.includes(parsed.result as 'clean' | 'flagged' | 'inconclusive')
      ? (parsed.result as 'clean' | 'flagged' | 'inconclusive')
      : 'inconclusive';

    return {
      ai_result: result,
      ai_confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
      ai_description: String(parsed.description || 'No description provided').slice(0, 1000),
    };
  } catch (err) {
    console.error('[AI] Photo comparison failed:', err);
    return {
      ai_result: 'inconclusive',
      ai_confidence: 0,
      ai_description: `Automated comparison failed: ${err instanceof Error ? err.message : 'unknown error'}. Requires manual review.`,
    };
  }
}

// ── Session-level comparison orchestrator ─────────────────────────────────────

/**
 * Run AI comparisons for all checklist items in a session that have both
 * before and after photos. Called automatically on session end.
 *
 * Returns summary stats written to the session record.
 */
export async function runSessionComparisons(sessionId: string): Promise<{
  total: number;
  clean: number;
  flagged: number;
  inconclusive: number;
  ai_handover_score: number;
  ai_flags_count: number;
}> {
  // Get all checklist items for this session's site
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      contract: {
        include: {
          site_slot: {
            include: {
              site: { include: { site_checklist_items: { orderBy: { sort_order: 'asc' } } } },
            },
          },
        },
      },
      session_photos: true,
      photo_comparisons: true,
    },
  });

  if (!session) throw new Error(`Session ${sessionId} not found`);

  const checklistItems = session.contract.site_slot.site.site_checklist_items;
  const photos = session.session_photos;

  let clean = 0;
  let flagged = 0;
  let inconclusive = 0;

  for (const item of checklistItems) {
    // Skip if comparison already exists
    const existing = session.photo_comparisons.find(
      (c) => c.checklist_item_id === item.id,
    );
    if (existing) {
      if (existing.ai_result === 'clean') clean++;
      else if (existing.ai_result === 'flagged') flagged++;
      else inconclusive++;
      continue;
    }

    // Find before and after photos for this checklist item
    const beforePhoto = photos.find(
      (p) => p.checklist_item_id === item.id && p.photo_type === 'before',
    );
    const afterPhoto = photos.find(
      (p) => p.checklist_item_id === item.id && p.photo_type === 'after',
    );

    if (!beforePhoto) {
      // No before photo — skip (not required for comparison)
      continue;
    }

    const result = await comparePhotos(
      beforePhoto.storage_key,
      afterPhoto?.storage_key ?? null,
      item.area_name,
      item.description,
    );

    // Save comparison record
    await prisma.photoComparison.create({
      data: {
        session_id: sessionId,
        checklist_item_id: item.id,
        before_photo_id: beforePhoto.id,
        after_photo_id: afterPhoto?.id ?? null,
        ai_result: result.ai_result,
        ai_confidence: result.ai_confidence,
        ai_description: result.ai_description,
        admin_override: null,
        admin_override_by: null,
      },
    });

    if (result.ai_result === 'clean') clean++;
    else if (result.ai_result === 'flagged') flagged++;
    else inconclusive++;
  }

  const total = clean + flagged + inconclusive;

  // Score: 100 * (clean / total), penalised for flags
  const ai_handover_score = total === 0
    ? 100
    : Math.round(100 * (clean / total));

  const ai_flags_count = flagged + inconclusive;

  // Update session with AI summary
  await prisma.session.update({
    where: { id: sessionId },
    data: { ai_handover_score, ai_flags_count },
  });

  return { total, clean, flagged, inconclusive, ai_handover_score, ai_flags_count };
}
