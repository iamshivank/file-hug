import { NextRequest, NextResponse } from 'next/server';
import { memoryService } from '@/features/memories/services/MemoryService';

export async function GET(): Promise<NextResponse> {
  try {
    const result = await memoryService.getAll();
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
    const body = await request.json();
    const result = await memoryService.save(body);

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
