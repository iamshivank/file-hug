import { NextRequest, NextResponse } from 'next/server';
import { waitlistService } from '@/services/waitlist.service';
import { WaitlistFormData } from '@/types/waitlist.types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: WaitlistFormData = await request.json();
    const result = await waitlistService.addToWaitlist(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Waitlist API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error. Please try again later.' },
      { status: 500 }
    );
  }
}
