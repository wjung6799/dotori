import mongoose from 'mongoose';

// Free-text feedback a tutor (or admin) writes for a family. Shown to the parent
// in their profile's Feedback tab. Mirrors the Report model's family linkage.
const feedbackSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tutorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Tutor', default: null },
  tutorName:   { type: String, default: '' }, // denormalized author name for display
  studentName: { type: String, default: '' },
  text:        { type: String, required: true, trim: true },
  createdAt:   { type: Date, default: Date.now },
});

feedbackSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
