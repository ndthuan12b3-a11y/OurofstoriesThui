import React from 'react';
import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, variant = 'rectangular' }) => {
  return (
    <div
      className={cn(
        "animate-pulse bg-gray-200",
        variant === 'circular' ? "rounded-full" : "rounded-2xl",
        className
      )}
    />
  );
};

export const GallerySkeleton = () => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {[...Array(8)].map((_, i) => (
      <Skeleton key={i} className="aspect-square w-full" />
    ))}
  </div>
);

export const TimelineSkeleton = () => (
  <div className="space-y-8">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="flex gap-4">
        <Skeleton className="w-32 h-32 shrink-0" />
        <div className="flex-grow space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);
