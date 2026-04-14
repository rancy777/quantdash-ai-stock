import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'red' | 'green' | 'blue' | 'purple';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '' }) => {
  const styles = {
    default: 'bg-gray-700 text-gray-300',
    outline: 'border border-gray-600 text-gray-400',
    red: 'bg-red-500/20 text-red-400 border border-red-500/30',
    green: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  };

  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;