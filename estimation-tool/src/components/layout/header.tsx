'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useMenuStore } from '@/stores/menu-store';

interface HeaderProps {
  projectName?: string;
}

const PAGE_NAMES: Record<string, string> = {
  '/materials': '部材マスタ',
};

export function Header({ projectName }: HeaderProps) {
  const pathname = usePathname();
  const toggleMenu = useMenuStore((s) => s.toggleMenu);

  const getPageName = () => {
    for (const [path, name] of Object.entries(PAGE_NAMES)) {
      if (pathname === path || pathname.startsWith(path + '/')) {
        return name;
      }
    }
    if (pathname.includes('/viewer/')) return 'ビューワー';
    return '積算ツール';
  };

  const breadcrumb = projectName
    ? `積算ツール > ${projectName}`
    : `積算ツール > ${getPageName()}`;

  return (
    <header className="fixed top-0 w-full z-40">
      {/* Top Bar */}
      <div className="h-[48px] bg-[#52555F] flex items-center px-4 relative">
        <button
          onClick={toggleMenu}
          className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Image
            src="/conoc_logo2.jpg"
            alt="CONOC"
            width={120}
            height={32}
            className="h-[28px] w-auto object-contain"
            priority
          />
        </div>
      </div>
      {/* Breadcrumb Bar */}
      <div className="h-[36px] bg-[#0099CB] flex items-center px-4">
        <span className="text-sm text-white font-medium">{breadcrumb}</span>
      </div>
    </header>
  );
}
