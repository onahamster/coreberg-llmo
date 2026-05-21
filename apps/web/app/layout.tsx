import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coreberg LLMO',
  description: 'AI Search Engine Optimization Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
