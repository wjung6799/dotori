import mongoose from 'mongoose';

// Atomic sequence source for human-facing numbers (invoice numbers today).
// Counting existing documents would race: two enrollments saved in the same
// second would both read the same count and mint the same invoice number.
const counterSchema = new mongoose.Schema({
  _id: { type: String }, // e.g. 'invoice-2026'
  seq: { type: Number, default: 0 },
});

export default mongoose.models.Counter || mongoose.model('Counter', counterSchema);
