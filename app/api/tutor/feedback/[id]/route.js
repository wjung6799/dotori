import dbConnect from '@/lib/db';
import Feedback from '@/lib/models/Feedback';
import { unauthorized } from '@/lib/auth-helpers';
import { getMyTutor } from '@/lib/tutor-helpers';
import { canEditFeedback } from '@/lib/feedback-helpers';

export const dynamic = 'force-dynamic';

// Load the note and check the caller may change it. Returns a Response on
// failure so the handlers can `return` it directly.
async function loadEditable(params) {
  const { user, tutor } = await getMyTutor();
  if (!user) return { res: unauthorized() };
  const { id } = await params;
  await dbConnect();
  const fb = await Feedback.findById(id);
  if (!fb) return { res: Response.json({ error: 'Feedback not found.' }, { status: 404 }) };
  if (!canEditFeedback(fb, user, tutor)) {
    return { res: Response.json({ error: 'Only the tutor who wrote this note (or an admin) can change it.' }, { status: 403 }) };
  }
  return { fb };
}

// PATCH /api/tutor/feedback/:id, body: { text, studentName }: the author (or an
// admin) rewrites a note. The family sees the new text in place; the original
// send date stays, and updatedAt records the edit.
export async function PATCH(request, { params }) {
  const { fb, res } = await loadEditable(params);
  if (res) return res;

  try {
    const body = (await request.json()) || {};
    if (body.text !== undefined) {
      const text = String(body.text).trim();
      if (!text) return Response.json({ error: 'Feedback text is required.' }, { status: 400 });
      fb.text = text;
    }
    if (body.studentName !== undefined) fb.studentName = String(body.studentName).trim();
    fb.updatedAt = new Date();
    await fb.save();
    return Response.json({ ok: true, feedback: { ...fb.toObject(), canEdit: true } });
  } catch (err) {
    console.error('Update feedback error:', err);
    return Response.json({ error: 'Failed to update feedback.' }, { status: 500 });
  }
}

// DELETE /api/tutor/feedback/:id: remove a note. It disappears from the
// family's Reports & feedback page as well.
export async function DELETE(request, { params }) {
  const { fb, res } = await loadEditable(params);
  if (res) return res;

  try {
    await fb.deleteOne();
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Delete feedback error:', err);
    return Response.json({ error: 'Failed to delete feedback.' }, { status: 500 });
  }
}
