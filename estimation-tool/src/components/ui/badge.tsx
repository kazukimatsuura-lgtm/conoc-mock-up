'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border border-transparent',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-700',
        vip: 'bg-gradient-to-r from-amber-400 to-amber-600 text-white font-bold',
        trial: 'bg-cyan-100 text-cyan-700',
        demo: 'bg-gray-100 text-gray-700',
        success: 'bg-green-100 text-green-700',
        warning: 'bg-yellow-100 text-yellow-700',
        error: 'bg-red-100 text-red-700',
        info: 'bg-cyan-100 text-cyan-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

// Status badge helper
export function StatusBadge({ status }: { status: 'draft' | 'in_progress' | 'completed' | string }) {
  const statusConfig = {
    draft: { label: '未着手', variant: 'default' as const },
    in_progress: { label: '進行中', variant: 'info' as const },
    completed: { label: '完了', variant: 'success' as const },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// License badge helper
export function LicenseBadge({ type }: { type: 'DEMO' | 'TRIAL' | 'VIP' | 'STANDARD' }) {
  const config = {
    DEMO: { label: 'DEMO', variant: 'demo' as const },
    TRIAL: { label: 'TRIAL', variant: 'trial' as const },
    VIP: { label: 'VIP LICENSE', variant: 'vip' as const },
    STANDARD: { label: 'STANDARD', variant: 'default' as const },
  };

  const { label, variant } = config[type] || config.DEMO;
  return <Badge variant={variant}>{label}</Badge>;
}

export { Badge, badgeVariants };
