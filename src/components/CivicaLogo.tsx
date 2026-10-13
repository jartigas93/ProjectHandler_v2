import React from 'react';

interface CivicaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const CivicaIsotype: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 28 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="civicaGrad" x1="0%" y1="0%" x2="87%" y2="87%">
          <stop offset="0%" stopColor="#FF5038" />
          <stop offset="100%" stopColor="#EE880E" />
        </linearGradient>
      </defs>
      {/* Background container or circle */}
      <rect width="100" height="100" rx="24" fill="url(#civicaGrad)" />
      {/* Stylized 'a' isotipo tilted at -18° as defined in Cívica Corporate Identity Manual */}
      <g transform="translate(50, 52) rotate(-18) translate(-50, -50)">
        {/* Outer loop of 'a' */}
        <circle cx="50" cy="50" r="24" stroke="#ffffff" strokeWidth="9" fill="none" />
        {/* Inner stem of 'a' */}
        <path
          d="M 68 26 L 68 74"
          stroke="#ffffff"
          strokeWidth="9"
          strokeLinecap="round"
        />
        {/* Top curved shoulder */}
        <path
          d="M 40 26 C 58 24 68 34 68 46"
          stroke="#ffffff"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
};

export const CivicaWordmark: React.FC<{ className?: string; color?: string }> = ({
  className = '',
  color = '#ffffff',
}) => {
  return (
    <span className={`inline-flex items-baseline font-bold tracking-tight ${className}`} style={{ color }}>
      <span className="font-extrabold text-[1.15em] lowercase">cívica</span>
    </span>
  );
};

export const ProyectHandlerBrand: React.FC<CivicaLogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
}) => {
  const iconSize = size === 'sm' ? 24 : size === 'lg' ? 40 : 32;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <CivicaIsotype size={iconSize} />
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="font-black tracking-tight text-white font-['Lato'] text-lg sm:text-xl">
            ProyectHandler
          </span>
          <span className="px-1.5 py-0.2 rounded-sm bg-[#FF5038]/20 border border-[#FF5038]/40 text-[#FF5038] text-[10px] font-bold tracking-wide uppercase">
            CÍVICA
          </span>
        </div>
        {showSubtitle && (
          <span className="text-[11px] text-slate-400 font-['Montserrat'] hidden sm:block">
            Teams & Jira Intelligent Delivery Platform
          </span>
        )}
      </div>
    </div>
  );
};
