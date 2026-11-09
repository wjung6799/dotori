import mongoose from 'mongoose';

// Free-text feedback a tutor (or admin) writes for a family. Shown to the parent
// in their profile's Feedback tab. Mirrors the Report model's family linkage.
const feedbackSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tutorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Tutor', default: null },
  tutorName:   { type: String, default: '' }, // denormalized author name for display
  studentName: { type: String, default: '' },
  // Which class the note is about and which lesson (YYYY-MM-DD, Pacific). Both
  // optional: a note written from the "one student" form carries neither.
  classId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  lessonDate:  { type: String, default: '' },
  text:        { type: String, required: true, trim: true },
  createdAt:   { type: Date, default: Date.now },
  // Stamped when the author edits the note after sending; null when untouched.
  updatedAt:   { type: Date, default: null },
  // The conversation under a note: the family replies, the instructor (or an
  // admin) answers. Oldest first. `from` decides whose side it sits on and who
  // gets emailed; authorName is denormalized like tutorName.
  replies: {
    type: [
      new mongoose.Schema(
        {
          from:       { type: String, enum: ['family', 'tutor'], required: true },
          authorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
          authorName: { type: String, default: '' },
          text:       { type: String, required: true, trim: true, maxlength: 4000 },
          createdAt:  { type: Date, default: Date.now },
        },
        { _id: true },
      ),
    ],
    default: [],
  },
});

feedbackSchema.index({ userId: 1, createdAt: -1 });
feedbackSchema.index({ classId: 1, createdAt: -1 });

export default mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
