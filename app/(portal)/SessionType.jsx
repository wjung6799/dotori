// The session-kind badge every booking list shows. No hooks, so server and
// client components can both render it. Expects booking.session from
// lib/bookingSession.annotateSessions.

const TONE = {
  buyout: 'warn',
  private: 'warn',
  semi_private: 'ok',
  assessment: 'info',
};

export function SessionTypePill({ session, style }) {
  if (!session || !session.type) return null;
  return (
    <span className={`pill ${TONE[session.type] || 'mute'}`} title={session.detail || undefined} style={style}>
      {session.label}
    </span>
  );
}

// "Semi-private · 2 of 3 seats filled · with Yeonsu Kim" as a quiet line.
export function SessionTypeDetail({ session }) {
  if (!session || !session.type || !session.detail) return null;
  return <div className="meta small">{session.label} · {session.detail}</div>;
}
