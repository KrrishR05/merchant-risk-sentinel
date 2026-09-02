'use client';

import React from 'react';
import { RiskSutraMark } from './RiskSutraMark';

export type LogoVariant = 'full' | 'compact' | 'iconOnly';

interface RiskSutraLogoProps {
  variant?: LogoVariant;
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  className?: string;
  onClick?: () => void;
}

export const RiskSutraLogo: React.FC<RiskSutraLogoProps> = ({
  variant = 'full',
  size = 'md',
  animated = true,
  className = '',
  onClick,
}) => {
  // Dimension mapping
  let markSize = 44;
  let wordmarkFontSize = '1.75rem';
  let subtitleFontSize = '0.62rem';
  let poweredFontSize = '0.58rem';

  if (typeof size === 'number') {
    markSize = size;
    wordmarkFontSize = `${size * 0.4}px`;
    subtitleFontSize = `${size * 0.14}px`;
    poweredFontSize = `${size * 0.13}px`;
  } else {
    switch (size) {
      case 'sm':
        markSize = 28;
        wordmarkFontSize = '1.15rem';
        subtitleFontSize = '0.45rem';
        poweredFontSize = '0.42rem';
        break;
      case 'md':
        markSize = 34;
        wordmarkFontSize = '1.3rem';
        subtitleFontSize = '0.48rem';
        poweredFontSize = '0.45rem';
        break;
      case 'lg':
        markSize = 54;
        wordmarkFontSize = '2rem';
        subtitleFontSize = '0.65rem';
        poweredFontSize = '0.6rem';
        break;
      case 'xl':
        markSize = 72;
        wordmarkFontSize = '2.6rem';
        subtitleFontSize = '0.78rem';
        poweredFontSize = '0.72rem';
        break;
    }
  }

  if (variant === 'iconOnly') {
    return (
      <div
        className={`risksutra-logo-wrapper logo-icon-only ${className}`}
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default', display: 'inline-flex' }}
      >
        <RiskSutraMark size={markSize} animated={animated} />
      </div>
    );
  }

  return (
    <div
      className={`risksutra-logo-wrapper logo-variant-${variant} ${className}`}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: variant === 'compact' ? '0.5rem' : '0.75rem',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        maxWidth: '100%',
      }}
    >
      <RiskSutraMark size={markSize} animated={animated} />

      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, flex: 1 }}>
        {/* Main Wordmark "RiskSūtra" */}
        <div
          style={{
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            fontSize: wordmarkFontSize,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'baseline',
          }}
        >
          <span style={{ color: '#F8FAFC' }}>Risk</span>
          <span
            style={{
              background: 'linear-gradient(135deg, #38BDF8 0%, #6366F1 50%, #A855F7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              paddingLeft: '1px',
            }}
          >
            Sūtra
          </span>
        </div>

        {/* Subtitle Lines (for 'full' variant) */}
        {variant === 'full' && (
          <>
            <div
              style={{
                fontSize: subtitleFontSize,
                fontWeight: 600,
                color: '#94A3B8',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginTop: '0.35rem',
                whiteSpace: 'nowrap',
              }}
            >
              MERCHANT RISK INTELLIGENCE
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginTop: '0.25rem',
                color: '#64748B',
                fontSize: poweredFontSize,
                fontWeight: 600,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  flex: 1,
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.4))',
                }}
              />
              <span
                style={{
                  background: 'linear-gradient(90deg, #38BDF8, #A855F7)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                POWERED BY AI
              </span>
              <span
                style={{
                  flex: 1,
                  height: '1px',
                  background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.4), transparent)',
                }}
              />
            </div>
          </>
        )}

        {/* Compact subtitle (for 'compact' variant) */}
        {variant === 'compact' && (
          <div
            style={{
              fontSize: subtitleFontSize,
              fontWeight: 600,
              color: '#64748B',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginTop: '0.15rem',
              whiteSpace: 'nowrap',
            }}
          >
            MERCHANT INTELLIGENCE
          </div>
        )}
      </div>
    </div>
  );
};
