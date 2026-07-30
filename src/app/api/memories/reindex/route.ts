import { NextRequest, NextResponse } from 'next/server';
import { indexMemory } from '@/features/memories/services/IntelligenceClient';
import { memoryRepository } from '@/features/memories/repositories/MemoryRepository';
import { getSession, getSessionToken } from '@/features/auth/session';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `POST /api/memories/reindex` — re-open a saved link and rebuild its search index.
 *
 * Unlike the fire-and-forget indexing that follows a save, this waits for the
 * result and returns the fresh enrichment, so the preview can update in place.
 * It backs the "retry" affordance on a link whose first read failed (a timeout, a
 * site that was briefly down) and doubles as a manual refresh for one that has
 * since changed.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session || session.user.isDemo) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const id = typeof body?.id === 'string' ? body.id : null;
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json(
        { success: false, error: 'A valid memory id is required.' },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const memory = await memoryRepository.findById(id, userId);
    if (!memory) {
      return NextResponse.json({ success: false, error: 'Memory not found.' }, { status: 404 });
    }
    if (memory.type !== 'url') {
      return NextResponse.json(
        { success: false, error: 'Only links can be indexed.' },
        { status: 400 }
      );
    }

    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    // `force` because the point of an explicit retry is to redo work that a
    // ready-row check would otherwise skip.
    const result = await indexMemory(id, token, { force: true });
    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'The memory intelligence service is unavailable. Try again shortly.',
        },
        { status: 502 }
      );
    }

    // Read the persisted row back rather than trusting the response shape — this
    // is what every other client read of this memory will see.
    const enrichment = await memoryRepository.findEnrichment(id, userId);
    const refreshed = await memoryRepository.findById(id, userId);

    return NextResponse.json({
      success: true,
      data: { memory: { ...(refreshed ?? memory), enrichment } },
    });
  } catch (error) {
    console.error('Memories reindex error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to re-index this link.' },
      { status: 500 }
    );
  }
}
