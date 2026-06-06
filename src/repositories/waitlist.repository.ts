import { connectToDatabase } from '@/lib/mongodb';
import Waitlist, { IWaitlist } from '@/models/Waitlist';
import { WaitlistFormData } from '@/types/waitlist.types';

export class WaitlistRepository {
  async create(data: WaitlistFormData): Promise<IWaitlist> {
    await connectToDatabase();
    const entry = await Waitlist.create(data);
    return entry;
  }

  async findByEmail(email: string): Promise<IWaitlist | null> {
    await connectToDatabase();
    return Waitlist.findOne({ email: email.toLowerCase().trim() });
  }

  async count(): Promise<number> {
    await connectToDatabase();
    return Waitlist.countDocuments();
  }
}

export const waitlistRepository = new WaitlistRepository();
