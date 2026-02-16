'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  ScanLine,
  Plus,
  FolderOpen,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMenuStore } from '@/stores/menu-store';
import { useProjectStore } from '@/stores/project-store';
import { NewProjectModal } from '@/components/project/new-project-modal';

const STATIC_MENU_ITEMS = [
  { id: 'materials', label: '部材マスタ', icon: Package, href: '/materials' },
];

export function HamburgerMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const { isMenuOpen: isOpen, closeMenu: onClose } = useMenuStore();
  const { projects, loadProjects, deleteProject } = useProjectStore();
  const [showNewProject, setShowNewProject] = useState(false);

  // メニューが開いたらプロジェクト一覧を取得
  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen, loadProjects]);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, onClose]);

  // Escキーで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleOpenProject = useCallback((projectId: string) => {
    onClose();
    router.push(`/viewer/${projectId}`);
  }, [onClose, router]);

  const handleDeleteProject = useCallback(async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (confirm('このプロジェクトを削除しますか？')) {
      await deleteProject(projectId);
    }
  }, [deleteProject]);

  const handleNewProject = useCallback(() => {
    onClose();
    setShowNewProject(true);
  }, [onClose]);

  return (
    <>
      {/* オーバーレイ */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-[45] transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* スライドメニュー */}
      <div
        ref={menuRef}
        className={cn(
          'fixed top-0 left-0 bottom-0 w-[280px] bg-[#3d4049] z-[50] flex flex-col transition-transform duration-300 shadow-2xl',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between h-[48px] px-4 bg-[#52555F] flex-shrink-0">
          <span className="text-white text-sm font-medium">メニュー</span>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* メニューコンテンツ */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* 積算OCRセクション */}
          <div className="mb-1">
            <div className="px-4 py-2 bg-[#35383f]">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                積算OCR
              </span>
            </div>

            {/* 新規プロジェクト作成ボタン */}
            <button
              onClick={handleNewProject}
              className="w-full flex items-center gap-3 px-5 py-3 text-gray-300 hover:bg-[#4a4d56] hover:text-white transition-colors"
            >
              <Plus size={18} />
              <span className="text-sm">新規プロジェクト</span>
            </button>

            {/* プロジェクト一覧 */}
            {projects.length > 0 && (
              <div className="border-t border-[#52555F]">
                {projects.map((project) => {
                  const isActive = pathname === `/viewer/${project.id}`;
                  return (
                    <div
                      key={project.id}
                      onClick={() => handleOpenProject(project.id)}
                      className={cn(
                        'flex items-center gap-3 px-5 py-2.5 cursor-pointer group transition-colors',
                        isActive
                          ? 'bg-[#0099CB] text-white'
                          : 'text-gray-300 hover:bg-[#4a4d56] hover:text-white'
                      )}
                    >
                      <FolderOpen size={16} className="flex-shrink-0" />
                      <span className="text-sm truncate flex-1">{project.name}</span>
                      <button
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        className={cn(
                          'p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0',
                          isActive
                            ? 'hover:bg-white/20 text-white/70'
                            : 'hover:bg-red-500/20 text-gray-500 hover:text-red-400'
                        )}
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* マスタ管理セクション */}
          <div className="mb-1">
            <div className="px-4 py-2 bg-[#35383f]">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                マスタ管理
              </span>
            </div>

            {STATIC_MENU_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3 transition-colors',
                    isActive
                      ? 'bg-[#0099CB] text-white'
                      : 'text-gray-300 hover:bg-[#4a4d56] hover:text-white'
                  )}
                >
                  <item.icon size={18} />
                  <span className="text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* フッター */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-[#52555F] bg-[#35383f]">
          <p className="text-[10px] text-gray-500 text-center">
            CONOC 積算ツール v2.0
          </p>
        </div>
      </div>

      {/* 新規プロジェクトモーダル */}
      <NewProjectModal
        isOpen={showNewProject}
        onClose={() => setShowNewProject(false)}
      />
    </>
  );
}
