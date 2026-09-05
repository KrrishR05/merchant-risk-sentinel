'use client';

import React, { useState } from 'react';
import { KeyEvidenceItem } from '@/lib/api';

interface EvidenceCardProps {
  item: KeyEvidenceItem;
}

function getSeverityBadgeClass(sev: string) {
  switch (sev?.toUpperCase()) {
    case 'CRITICAL': return 'badge badge-critical';
    case 'HIGH': return 'badge badge-high';
    case 'MEDIUM': return 'badge badge-medium';
    default: return 'badge badge-low';
  }
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({ item }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.76rem', color: 'var(--accent-primary)' }}>
            {item.event_id}
          </span>
          <span className={getSeverityBadgeClass(item.severity)}>
            {item.severity}
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {item.signal}
          </span>
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {expanded ? 'Collapse ▴' : 'Expand ▾'}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Forensic Context: </strong>
            {item.reason}
          </p>
        </div>
      )}
    </div>
  );
};
