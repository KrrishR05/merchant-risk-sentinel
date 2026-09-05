'use client';

import React from 'react';
import { RiskSutraMark } from './RiskSutraMark';

export type LogoVariant = 'full' | 'compact' | 'iconOnly' | 'hero';

interface RiskSutraLogoProps {
  variant?: LogoVariant;
  size?: number | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'hero';
  animated?: boolean;
  orbitAnimated?: boolean;
  className?: string;
  onClick?: () => void;
}

export const RiskSutraLogo: React.FC<RiskSutraLogoProps> = ({
  variant = 'full',
  size = 'md',
  animated = true,
  orbitAnimated,
  className = '',
  onClick,
}) => {
  const isOrbiting = orbitAnimated !== undefined ? orbitAnimated : variant === 'hero';
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
      case '2xl':
        markSize = 92;
        wordmarkFontSize = '3.3rem';
        subtitleFontSize = '0.88rem';
        poweredFontSize = '0.8rem';
        break;
      case '3xl':
      case 'hero':
        markSize = 104;
        wordmarkFontSize = 'clamp(2.75rem, 5vw, 3.85rem)';
        subtitleFontSize = '0.92rem';
        poweredFontSize = '0.82rem';
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
        <RiskSutraMark size={markSize} animated={animated} orbitAnimated={isOrbiting} />
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div
        className={`risksutra-logo-wrapper logo-variant-hero ${className}`}
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '1.75rem',
          cursor: onClick ? 'pointer' : 'default',
          userSelect: 'none',
          maxWidth: '100%',
          flexWrap: 'wrap',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Emblem with surrounding ambient pulse */}
        <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              position: 'absolute',
              inset: '-16px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(56, 189, 248, 0.38) 0%, rgba(124, 58, 237, 0.22) 55%, transparent 75%)',
              filter: 'blur(16px)',
              pointerEvents: 'none',
              zIndex: 0,
              animation: 'auraBreathe 4s ease-in-out infinite',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <RiskSutraMark size={markSize} animated={animated} orbitAnimated={isOrbiting} />
          </div>
        </div>

        {/* Wordmark and Authority Subtext */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'left',
            minWidth: 0,
          }}
        >
          {/* Main Wordmark "RiskSūtra" */}
          <div
            style={{
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              fontSize: wordmarkFontSize,
              fontWeight: 850,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'baseline',
            }}
          >
            <span style={{ color: 'var(--text-primary)' }}>Risk</span>
            <span
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 45%, #7c3aed 85%, #a855f7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                paddingLeft: '3px',
                filter: 'drop-shadow(0 2px 10px rgba(37, 99, 235, 0.25))',
              }}
            >
              Sūtra
            </span>
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: subtitleFontSize,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              marginTop: '0.55rem',
              whiteSpace: 'nowrap',
            }}
          >
            MERCHANT RISK INTELLIGENCE
          </div>

          {/* AI Banner Line */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginTop: '0.45rem',
              color: 'var(--text-muted)',
              fontSize: poweredFontSize,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                width: '36px',
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.7))',
              }}
            />
            <span
              style={{
                background: 'linear-gradient(90deg, #0284c7, #7c3aed)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 700,
              }}
            >
              AI RISK INTELLIGENCE
            </span>
            <span
              style={{
                display: 'inline-block',
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: '#38BDF8',
              }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>
              ENTERPRISE SENTINEL
            </span>
            <span
              style={{
                width: '36px',
                height: '1px',
                background: 'linear-gradient(90deg, rgba(124, 58, 237, 0.7), transparent)',
              }}
            />
          </div>
        </div>
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
        gap: size === '2xl' || size === '3xl' ? '1.35rem' : variant === 'compact' ? '0.5rem' : '0.85rem',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        maxWidth: '100%',
      }}
    >
      <RiskSutraMark size={markSize} animated={animated} orbitAnimated={orbitAnimated ?? false} />

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
          <span style={{ color: 'var(--text-primary)' }}>Risk</span>
          <span
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #7c3aed 100%)',
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
                color: 'var(--text-secondary)',
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
