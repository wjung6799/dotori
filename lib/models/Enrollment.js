import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema({
  userId:                 { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName:            { type: String, required: true },
  classId:                { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  quarter:                { type: String, required: true },
  paymentStatus:          { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
  stripePaymentIntentId:  { type: String, default: '' },
  amountPaid:             { type: Number, default: 0 },
  enrolledAt:             { type: Date, default: Date.now },
  paidAt:                 { type: Date },
  dayChoice:              { type: String, default: '' }, // selected day for multi-day classes
  notes:                  { type: String, default: '' },
});

export default mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);
