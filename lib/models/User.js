import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  grade: { type: String, default: '' },
});

// Shared `users` collection — also written by the Auth.js MongoDB adapter
// (Google sign-in) and the credentials register route. `required` is relaxed
// from the original Express model so those adapter-created docs validate.
const userSchema = new mongoose.Schema({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: '' },
  name:         { type: String, default: '' },
  firstName:    { type: String, default: '', trim: true },
  lastName:     { type: String, default: '', trim: true },
  phone:        { type: String, default: '' },
  role:         { type: String, enum: ['family', 'admin', 'user', 'tutor'], default: 'family' },
  students:     [studentSchema],
  createdAt:    { type: Date, default: Date.now },
});

export default mongoose.models.User || mongoose.model('User', userSchema);
