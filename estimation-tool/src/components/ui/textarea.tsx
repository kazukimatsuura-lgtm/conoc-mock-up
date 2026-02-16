'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="text-sm font-bold text-gray-700">{label}</label>
        )}
        <textarea
          className={cn(
            'w-full p-2 border border-gray-300 rounded-lg resize-none',
            'focus:ring-2 focus:ring-[#0099CB] focus:border-[#0099CB] outline-none',
            'disabled:bg-gray-50 disabled:cursor-not-allowed',
            'transition-colors duration-200',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
