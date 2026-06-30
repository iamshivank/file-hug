import { waitlistRepository } from '@/repositories/waitlist.repository';
import { WaitlistFormData, ApiResponse, WaitlistSuccessData } from '@/types/waitlist.types';

export class WaitlistService {
  private validateEmail(email: string): boolean {
    const emailRegex = /^\S+@\S+\.\S+$/;
    return emailRegex.test(email);
  }

  async addToWaitlist(data: WaitlistFormData): Promise<ApiResponse<WaitlistSuccessData>> {
    const name = data.name?.trim();
    const email = data.email?.trim().toLowerCase();

    if (!name || name.length === 0) {
      return { success: false, error: 'Name is required.' };
    }

    if (name.length > 100) {
      return { success: false, error: 'Name cannot exceed 100 characters.' };
    }

    if (!email || email.length === 0) {
      return { success: false, error: 'Email is required.' };
    }

    if (!this.validateEmail(email)) {
      return { success: false, error: 'Please provide a valid email address.' };
    }

    const existing = await waitlistRepository.findByEmail(email);
    if (existing) {
      return { success: false, error: 'This email is already on the waitlist.' };
    }

    try {
      const { position } = await waitlistRepository.create({ name, email });
      return { success: true, data: { message: 'Successfully joined the waitlist!', position } };
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return { success: false, error: 'This email is already on the waitlist.' };
      }
      throw error;
    }
  }
}

export const waitlistService = new WaitlistService();
