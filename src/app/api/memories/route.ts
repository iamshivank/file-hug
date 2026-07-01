import { NextRequest, NextResponse } from 'next/server';
import { memoryService } from '@/features/memories/services/MemoryService';
import { getSession } from '@/features/auth/session';

/** Resolve the scoping user id from the session (ignore demo users on the DB path). */
async function currentUserId(): Promise<string | undefined> {
  const session = await getSession();
  if (!session || session.user.isDemo) return undefined;
  return session.user.id;
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
  try {
    const userId = await currentUserId();
    const body = await request.json();
    const result = await memoryService.save(body, userId);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Memories POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save memory.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const result = await memoryService.update(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
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
