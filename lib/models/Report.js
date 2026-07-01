import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  classId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  quarter:     { type: String, required: true },
  title:       { type: String, required: true },
  // Now a Vercel Blob URL (was a relative disk path under Express). The admin
  // upload route stores the full Blob URL here so the profile page can link it.
  pdfPath:     { type: String, required: true },
  uploadedAt:  { type: Date, default: Date.now },
});

export default mongoose.models.Report || mongoose.model('Report', reportSchema);
