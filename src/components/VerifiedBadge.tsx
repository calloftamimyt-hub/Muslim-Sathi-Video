import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  isVerified?: boolean;
  isOwner?: boolean;
  className?: string;
  size?: number;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ 
  isVerified, 
  isOwner, 
  className,
  size = 16
}) => {
  if (isVerified) {
    return (
      <BadgeCheck 
        size={size}
        className={cn("text-[#3b82f6] fill-[#3b82f6]/10", className)} 
      />
    );
  }
  
  // Only show red unverified mark if explicitly false and user is the owner
  // We want to avoid showing red then switching to blue for verified users during data fetching
  if (isOwner && isVerified === false) {
    return (
      <BadgeCheck 
        size={size}
        className={cn("text-[#ef4444] fill-[#ef4444]/10 opacity-60", className)} 
      />
    );
  }
  
  return null;
};
