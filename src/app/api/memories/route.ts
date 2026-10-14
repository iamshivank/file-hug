import { NextRequest, NextResponse, after } from 'next/server';
import { memoryService } from '@/features/memories/services/MemoryService';
import { getSession, getSessionToken } from '@/features/auth/session';

export const maxDuration = 180;

/** Resolve the scoping user id from the session (ignore demo users on the DB path). */
async function currentUserId(): Promise<string | undefined> {
  const session = await getSession();
  if (!session || session.user.isDemo) return undefined;
  return session.user.id;
}

/** Parse a JSON body, or null when it isn't valid JSON (a 400, not a 500). */
async function readJson(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => null);
}

/**
 * Index a link once the response has been sent. Opening the link takes seconds;
 * the user should not wait for it. Only called when the memory carries a
 * `pending` enrichment — i.e. the service is configured and the pending row was
 * written — so there is something for the service to update.
 */
async function indexAfterResponse(memoryId: string, userId: string, force: boolean): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  after(() => memoryService.indexLink(memoryId, userId, token, { force }));
}

export async function GET(): Promise<NextResponse> {
  try {
    const userId = await currentUserId();
    const result = await memoryService.getAll(userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Memories GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch memories.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let result;
  let userId: string | undefined;
  try {
    userId = await currentUserId();
    // Writes need a real account — demo sessions are client-only and never
    // touch the database.
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const body = await readJson(request);
    result = await memoryService.save(body as Parameters<typeof memoryService.save>[0], userId);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Memories POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save memory.' },
      { status: 500 }
    );
  }

  // Post-save indexing is OUTSIDE the try/catch so errors here cannot be
  // misreported as save errors (the save already succeeded). The memory is
  // already stored with `enrichment.status = 'pending'` so the UI can show the
  // work in flight.
  //
  // Gated on that pending row actually existing: if the index table is missing,
  // the service has nowhere to write and there is no point waking it up.
  const saved = result.data?.memory;
  if (saved?.type === 'url' && saved.enrichment?.status === 'pending') {
    await indexAfterResponse(saved.id, userId, false);
  }

  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await currentUserId();
    // Deny unauthenticated/demo requests explicitly rather than passing undefined.
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const body = await readJson(request);
    const result = await memoryService.update(
      body as Parameters<typeof memoryService.update>[0],
      userId
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // The service resets a link's index only when its URL actually changed, and
    // marks it pending only when the intelligence service is configured.
    const updated = result.data?.memory;
    if (updated?.type === 'url' && updated.enrichment?.status === 'pending') {
      await indexAfterResponse(updated.id, userId, true);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Memories PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update memory.' },
      { status: 500 }
    );
  }
}
