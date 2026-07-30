import { NextRequest, NextResponse } from 'next/server';
import { memoryService } from '@/features/memories/services/MemoryService';
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

    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const result = await memoryService.reindex(id, userId, token);

    if (!result.success) {
      const status = result.error?.includes('not found') ? 404 :
                     result.error?.includes('unavailable') ? 502 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Memories reindex error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to re-index this link.' },
      { status: 500 }
    );
  }
}
