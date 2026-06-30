import { db } from '@/lib/db';
import { waitlist } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { IWaitlist } from '@/models/Waitlist';
import { WaitlistFormData } from '@/types/waitlist.types';

export class WaitlistRepository {
  async create(data: WaitlistFormData): Promise<{ entry: IWaitlist; position: number }> {
    const [entry] = await db.insert(waitlist).values(data).returning();
    const [{ total }] = await db.select({ total: count() }).from(waitlist);
    return { entry, position: Number(total) };
  }

  async findByEmail(email: string): Promise<IWaitlist | null> {
    const [entry] = await db.select().from(waitlist).where(eq(waitlist.email, email)).limit(1);
    return entry ?? null;
  }

  async count(): Promise<number> {
    const [{ total }] = await db.select({ total: count() }).from(waitlist);
    return Number(total);
  }
}

export const waitlistRepository = new WaitlistRepository();
