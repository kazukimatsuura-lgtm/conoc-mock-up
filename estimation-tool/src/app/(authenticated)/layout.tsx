'use client';

import { usePathname } from 'next/navigation';
import { Header, Footer, HamburgerMenu } from '@/components/layout';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isViewerPage = pathname.includes('/viewer/');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col overflow-hidden">
      <Header />

      <HamburgerMenu />

      <main className="flex-1 flex mt-[84px] relative">
        <div className="flex-1 w-full relative">{children}</div>
      </main>

      {!isViewerPage && <Footer />}
    </div>
  );
}
