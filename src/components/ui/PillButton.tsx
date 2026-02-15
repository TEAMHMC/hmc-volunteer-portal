import React from 'react';

type PillVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type PillSize = 'sm' | 'md' | 'lg';

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillVariant;
  size?: PillSize;
  children: React.ReactNode;
}

const variantStyles: Record<PillVariant, string> = {
  primary: 'bg-brand border border-zinc-950 text-white hover:bg-brand-hover',
  secondary: 'bg-white border border-zinc-950 text-zinc-900 hover:bg-zinc-50',
  danger: 'bg-rose-500 border border-rose-600 text-white hover:bg-rose-600',
  ghost: 'bg-transparent text-zinc-700 hover:bg-zinc-100',
};

const sizeStyles: Record<PillSize, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-sm',
};

const PillButton: React.FC<PillButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  return (
    <button
      className={`rounded-full font-bold uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default PillButton;
