import mongoose from 'mongoose';

// New-student enrollment survey a parent fills out once per student (siblings
// each get their own). Mirrors the questions of the original Google Form
// "Dotori School New Student Enrollment Form". One document per
// (family, studentName); resubmitting updates the existing one.
const enrollmentSurveySchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentName: { type: String, required: true, trim: true }, // profile student this belongs to

    // Student Information
    studentFullName: { type: String, required: true, trim: true },
    preferredName:   { type: String, required: true, trim: true },
    grade:           { type: String, required: true, trim: true },
    dateOfBirth:     { type: String, required: true, trim: true },
    homeLanguage:        { type: [String], default: [] }, // English / Korean / other free text
    homeLanguageOther:   { type: String, default: '' },
    schoolType:          { type: String, required: true }, // Public School / Private School / Homeschool / Other
    schoolTypeOther:     { type: String, default: '' },
    schoolDistrict:      { type: String, default: '' }, // only when Public School
    schoolDistrictOther: { type: String, default: '' },
    schoolName:          { type: String, default: '' }, // only when Public/Private

    // Parent/Guardian Information
    parentName:       { type: String, required: true, trim: true },
    parentEmail:      { type: String, required: true, trim: true },
    emergencyContact: { type: String, required: true, trim: true },

    // About the Student
    learningStyle: { type: String, required: true, trim: true },
    academicAreas: { type: String, required: true, trim: true },
    healthNotes:   { type: String, required: true, trim: true },
    hobbies:       { type: String, required: true, trim: true },
    otherNotes:    { type: String, default: '', trim: true },

    // Consent
    consentPersonalInfo: { type: Boolean, required: true },
    consentLiability:    { type: Boolean, required: true },
    mediaRelease:        { type: String, required: true, enum: ['agree', 'decline'] },
    consentHandbook:     { type: Boolean, required: true },

    // Last Question
    referral:      { type: String, required: true },
    referralOther: { type: String, default: '' },
  },
  { timestamps: true },
);

enrollmentSurveySchema.index({ userId: 1, studentName: 1 }, { unique: true });

export default mongoose.models.EnrollmentSurvey ||
  mongoose.model('EnrollmentSurvey', enrollmentSurveySchema);
