'use client';

import React from 'react';

interface RiskSutraMarkProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export const RiskSutraMark: React.FC<RiskSutraMarkProps> = ({
  size = 48,
  className = '',
  animated = true,
}) => {
  const markId = React.useId();
  const gradOuter = `grad-outer-${markId}`;
  const gradInner = `grad-inner-${markId}`;
  const gradSpark = `grad-spark-${markId}`;
  const gradAxis = `grad-axis-${markId}`;
  const glowFilter = `glow-${markId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`risksutra-mark ${animated ? 'animated-mark' : ''} ${className}`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        {/* Glow Filter */}
        <filter id={glowFilter} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Outer Arc Gradient (Cyan to Blue to Violet) */}
        <linearGradient id={gradOuter} x1="15" y1="105" x2="105" y2="15" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="35%" stopColor="#38BDF8" />
          <stop offset="70%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>

        {/* Inner Arc Gradient */}
        <linearGradient id={gradInner} x1="25" y1="95" x2="95" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.6" />
        </linearGradient>

        {/* Spark Diamond Gradient */}
        <linearGradient id={gradSpark} x1="45" y1="45" x2="75" y2="75" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="40%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#C084FC" />
        </linearGradient>

        {/* Axis Vertical Line Gradient */}
        <linearGradient id={gradAxis} x1="60" y1="5" x2="60" y2="115" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A855F7" stopOpacity="0.8" />
          <stop offset="30%" stopColor="#38BDF8" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#3B82F6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      <style>{`
        @keyframes sparkPulse {
          0%, 100% { transform: scale(1); opacity: 0.95; filter: drop-shadow(0 0 3px rgba(56, 189, 248, 0.6)); }
          50% { transform: scale(1.06); opacity: 1; filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.9)); }
        }
        @keyframes arcGlow {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        @keyframes axisGlow {
          0%, 100% { opacity: 0.75; }
          50% { opacity: 1; }
        }
        .animated-mark .spark-star {
          transform-origin: 60px 60px;
          animation: sparkPulse 4s ease-in-out infinite;
        }
        .animated-mark .main-arc {
          animation: arcGlow 3s ease-in-out infinite;
        }
        .animated-mark .axis-line {
          animation: axisGlow 3.5s ease-in-out infinite;
        }
      `}</style>

      {/* Background Subtle Outer Full Ring */}
      <circle
        cx="60"
        cy="60"
        r="48"
        stroke={`url(#${gradOuter})`}
        strokeWidth="1"
        strokeOpacity="0.25"
      />

      {/* Main Outer Segmented Glowing Arc (Top-Right around Left to Bottom) */}
      <path
        className="main-arc"
        d="M 60 12 A 48 48 0 1 0 42 106.5"
        stroke={`url(#${gradOuter})`}
        strokeWidth="3.5"
        strokeLinecap="round"
        filter={`url(#${glowFilter})`}
      />

      {/* Secondary Inner Arc */}
      <path
        d="M 60 22 A 38 38 0 0 0 32 86"
        stroke={`url(#${gradInner})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Right Side Thin Ring Segment */}
      <path
        d="M 72 15.5 A 48 48 0 0 1 72 104.5"
        stroke="#8B5CF6"
        strokeWidth="1.25"
        strokeOpacity="0.6"
        strokeDasharray="70 8"
      />

      {/* Right Side Inner Thin Arc Ticks */}
      <path
        d="M 70 28 A 38 38 0 0 1 70 92"
        stroke="#6366F1"
        strokeWidth="1"
        strokeOpacity="0.35"
      />

      {/* Central Vertical Axis Line */}
      <line
        className="axis-line"
        x1="60"
        y1="6"
        x2="60"
        y2="114"
        stroke={`url(#${gradAxis})`}
        strokeWidth="2"
        strokeLinecap="round"
        filter={`url(#${glowFilter})`}
      />

      {/* Central Spark Star (4-Point Diamond Spark) */}
      <path
        className="spark-star"
        d="M 60 42 Q 60 60 78 60 Q 60 60 60 78 Q 60 60 42 60 Q 60 60 60 42 Z"
        fill={`url(#${gradSpark})`}
        filter={`url(#${glowFilter})`}
      />
    </svg>
  );
};
