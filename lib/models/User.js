import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  grade: { type: String, default: '' },
});

// Shared `users` collection, also written by the Auth.js MongoDB adapter
// (Google sign-in) and the credentials register route. `required` is relaxed
// from the original Express model so those adapter-created docs validate.
const userSchema = new mongoose.Schema({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: '' },
  // Password recovery. Only the SHA-256 of the emailed token is stored, so a
  // database read can never be turned into a working reset link; the token is
  // single-use (cleared on reset) and dies at resetTokenExpiresAt. select:false
  // keeps both out of every mongoose query by default — the profile and admin
  // routes serialize user docs wholesale, and an internal credential artifact
  // must never reach a browser. (The /api/password routes use the raw driver
  // and are unaffected.)
  resetTokenHash: { type: String, default: null, select: false },
  resetTokenExpiresAt: { type: Date, default: null, select: false },
  // When the password last changed, stamped by /api/password/reset. Sessions
  // issued before this moment are evicted by the jwt callback in auth.js.
  passwordChangedAt: { type: Date, default: null },
  name:         { type: String, default: '' },
  firstName:    { type: String, default: '', trim: true },
  lastName:     { type: String, default: '', trim: true },
  phone:        { type: String, default: '' },
  role:         { type: String, enum: ['family', 'admin', 'user', 'tutor'], default: 'family' },
  students:     [studentSchema],
  createdAt:    { type: Date, default: Date.now },
});

export default mongoose.models.User || mongoose.model('User', userSchema);
