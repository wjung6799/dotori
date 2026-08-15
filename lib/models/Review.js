import mongoose from 'mongoose';

// Parent reviews, grouped by program. Submitted from the public /reviews page
// and hidden until an admin approves them at /admin/reviews.
export const REVIEW_PROGRAMS = ['math', 'literacy', 'korean', 'summer'];

const reviewSchema = new mongoose.Schema({
  program:    { type: String, required: true, enum: REVIEW_PROGRAMS },
  parentName: { type: String, required: true, trim: true }, // shown as given, e.g. "Grace K."
  rating:     { type: Number, min: 1, max: 5, default: 5 },
  text:       { type: String, required: true, trim: true },
  approved:   { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now },
});

reviewSchema.index({ program: 1, approved: 1, createdAt: -1 });

export default mongoose.models.Review || mongoose.model('Review', reviewSchema);
