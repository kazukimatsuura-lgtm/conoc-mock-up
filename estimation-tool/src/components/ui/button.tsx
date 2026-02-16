'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-[#0099CB] hover:bg-[#0088B4] text-white shadow-sm focus:ring-[#0099CB]',
        secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm focus:ring-gray-400',
        destructive: 'bg-white hover:bg-red-50 text-red-600 border border-red-200 focus:ring-red-400',
        ghost: 'bg-transparent hover:bg-gray-100 text-gray-600',
        icon: 'p-2 bg-transparent hover:bg-gray-100 text-gray-600 aspect-square',
        dark: 'bg-[#52555F] hover:bg-[#62656F] text-white shadow-sm focus:ring-gray-500',
        outline: 'bg-transparent hover:bg-[#E0F4FA] text-[#0088B4] border border-[#0099CB] focus:ring-[#0099CB]',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'px-3 py-1.5 text-xs',
        lg: 'px-6 py-3',
        icon: 'p-2',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  icon?: LucideIcon;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, icon: Icon, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {Icon && <Icon size={16} />}
        {children}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
