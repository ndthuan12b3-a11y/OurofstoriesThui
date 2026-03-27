import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CardProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'outline';
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  className = '',
  variant = 'default',
  onClick,
}) => {
  const variants = {
    default: 'bg-white shadow-md border border-slate-200',
    glass: 'bg-white/80 backdrop-blur-md border border-white/50 shadow-xl shadow-blue-100',
    outline: 'bg-transparent border border-slate-200 hover:border-blue-200 transition-all',
  };

  return (
    <div 
      className={`rounded-3xl overflow-hidden ${variants[variant]} ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''} ${className}`}
      onClick={onClick}
    >
      {(title || Icon) && (
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Icon size={20} />
              </div>
            )}
            <div>
              {title && <h3 className="text-sm font-bold text-slate-800">{title}</h3>}
              {subtitle && <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{subtitle}</p>}
            </div>
          </div>
        </div>
      )}
      
      <div className="p-5">
        {children}
      </div>
      
      {footer && (
        <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100">
          {footer}
        </div>
      )}
    </div>
  );
};
