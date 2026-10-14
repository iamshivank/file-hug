import LandingPage, { type LandingViewer } from '@/components/landing/LandingPage';
import { getSession } from '@/features/auth/session';
import { getUserPlan } from '@/features/billing/subscription';

export default async function Home() {
  // Signed-in visitors see their account menu and "Open library" instead of
  // sign-in prompts. Demo sessions still see the sign-up path — they have no account.
  const session = await getSession();
  const user = session && !session.user.isDemo ? session.user : null;
  const viewer: LandingViewer | null = user ? { user, plan: await getUserPlan(user.id) } : null;

  return <LandingPage viewer={viewer} />;
}
