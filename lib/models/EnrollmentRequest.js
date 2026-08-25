import mongoose from 'mongoose';

// An instructor proposing that a student join one of their classes. Instructors
// know who is ready for the next level, but placing a seat also bills a family,
// so the office approves before anything is charged. Approval creates the real
// Enrollment plus its Invoice.

const enrollmentRequestSchema = new mongoose.Schema({
  tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutor', required: true },
  tutorName: { type: String, default: '' }, // denormalized for the admin queue

  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },

  note: { type: String, default: '' }, // why this student, for the office

  status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending', index: true },
  decidedBy: { type: String, default: '' },
  decidedAt: { type: Date, default: null },
  declineReason: { type: String, default: '' },
  // Set on approval so the queue can link through to what it produced.
  enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment', default: null },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },

  createdAt: { type: Date, default: Date.now },
});

// One live request per student/class: re-requesting while one is pending is a
// duplicate, but a declined request may be raised again.
enrollmentRequestSchema.index(
  { userId: 1, studentName: 1, classId: 1, status: 1 },
  { partialFilterExpression: { status: 'pending' } },
);

export default mongoose.models.EnrollmentRequest ||
  mongoose.model('EnrollmentRequest', enrollmentRequestSchema);
