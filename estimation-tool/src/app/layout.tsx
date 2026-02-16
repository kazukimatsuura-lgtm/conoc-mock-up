import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CONOC 積算ツール',
  description: '建設図面からの数量拾い出しを自動化するAI OCRツール',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-50 font-sans text-gray-800 antialiased">
        {children}
      </body>
    </html>
  );
}
