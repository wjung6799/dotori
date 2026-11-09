'use client';

import { useState } from 'react';

import LocalTime from './LocalTime';

// The conversation under one feedback note, shared by the family's Reports page
// and the instructor's Feedback page. `viewer` decides which side reads as
// "you"; `endpoint` is where a new reply is POSTed ({ text }) and must answer
// with { reply }. Replies are kept in local state so posting doesn't reload the
// page around the reader; `onPosted(reply)` lets a parent list keep its copy in
// step. `readOnly` shows the thread without a reply box (an admin browsing
// another instructor's notes, say).
export default function FeedbackThread({
  endpoint,
  viewer,
  replies: initial = [],
  otherName,
  startOpen = false,
  onPosted,
  readOnly = false,
}) {
  const [replies, setReplies] = useState(initial);
  const [open, setOpen] = useState(startOpen);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not send your reply.');
      setReplies((r) => [...r, d.reply]);
      setText('');
      setOpen(false);
      onPosted?.(d.reply);
    } catch (e2) {
      setErr(e2.message || 'Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const replyLabel = viewer === 'family' ? `Reply to ${otherName || 'your instructor'}` : 'Answer';

  return (
    <div style={{ marginTop: replies.length || open ? '0.7rem' : '0.5rem' }}>
      {replies.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {replies.map((r, i) => {
            const mine = r.from === viewer;
            return (
              <div
                key={r._id || i}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  background: mine ? 'var(--ok-bg)' : 'var(--line-soft)',
                  borderRadius: 10,
                  padding: '0.45rem 0.7rem',
                }}
              >
                <div className="muted small" style={{ marginBottom: '0.15rem' }}>
                  {mine ? 'You' : r.authorName || (r.from === 'family' ? 'Family' : 'Instructor')}
                  {r.createdAt ? (
                    <>
                      {' · '}
                      <LocalTime iso={new Date(r.createdAt).toISOString()} format="full" />
                    </>
                  ) : null}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{r.text}</div>
              </div>
            );
          })}
        </div>
      ) : null}

      {readOnly ? null : open ? (
        <form onSubmit={send} style={{ marginTop: '0.6rem' }}>
          <textarea
            aria-label={replyLabel}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4000}
            placeholder={viewer === 'family' ? 'Ask a question or say thanks…' : 'Write your answer…'}
            style={{ width: '100%', minHeight: 90, resize: 'vertical' }}
            autoFocus
          />
          {err ? (
            <div className="notice err" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
              {err}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-accent btn-sm" disabled={busy || !text.trim()}>
              {busy ? 'Sending…' : 'Send'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setErr('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: replies.length ? '0.5rem' : 0 }}
          onClick={() => setOpen(true)}
        >
          {replyLabel}
        </button>
      )}
    </div>
  );
}
