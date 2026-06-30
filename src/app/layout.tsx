import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

// Warm, soft serif used for display headlines — gives the UI an editorial,
// hand-designed character instead of the generic sans-only SaaS look.
const fraunces = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'File Hug — Never lose something you wanted to remember',
  description:
    'Save reels, articles, ChatGPT conversations, memes, links and ideas in one place. Search them later using natural language. Your AI-powered memory for everything you discover online.',
  keywords: [
    'bookmarks',
    'save links',
    'AI memory',
    'natural language search',
    'content organizer',
    'digital memory',
    'File Hug',
  ],
  openGraph: {
    title: 'File Hug — Never lose something you wanted to remember',
    description:
      'Save reels, articles, ChatGPT conversations, memes, links and ideas in one place. Search them later using natural language.',
    type: 'website',
    siteName: 'File Hug',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'File Hug — Never lose something you wanted to remember',
    description:
      'Your AI-powered memory for everything you discover online.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased overflow-x-hidden`}>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
