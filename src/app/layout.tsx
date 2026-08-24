import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const instrumentSans = Instrument_Sans({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const bricolage = Bricolage_Grotesque({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
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
    <html lang="en" className={`${instrumentSans.variable} ${bricolage.variable} h-full antialiased overflow-x-hidden`}>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
