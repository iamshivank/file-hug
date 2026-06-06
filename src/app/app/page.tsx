import type { Metadata } from 'next';
import MemoryDashboard from '@/features/memories/components/MemoryDashboard';

export const metadata: Metadata = {
  title: 'File Hug — Your Memories',
  description: 'Save and rediscover everything you find on the internet.',
};

export default function AppPage() {
  return <MemoryDashboard />;
}
