'use client';

import { useEffect, useState } from 'react';

// Renders an ISO timestamp in the visitor's own timezone. Server-rendering the
// label would use the server clock (UTC on Vercel), so the text is filled in
// after hydration; the server pass emits a stable placeholder.
export default function LocalTime({ iso, format = 'full' }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const d = new Date(iso);
    const opts =
      format === 'date'
        ? { month: 'short', day: 'numeric', year: 'numeric' }
        : { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    setLabel(d.toLocaleString('en-US', opts));
  }, [iso, format]);

  return <span suppressHydrationWarning>{label || '—'}</span>;
}
