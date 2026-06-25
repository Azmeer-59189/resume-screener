const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['recruiter', 'candidate', 'admin'], required: true },
  fullName: { type: String, required: true, trim: true },
  company: { type: String, trim: true },       // for recruiters
  jobTitle: { type: String, trim: true },      // for recruiters
  phone: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  avatar: { type: String }
}, { timestamps: true });

userSchema.pre('save', async function() {
  if (!this.isModified('passwordHash')) return;
  if (!this.passwordHash.startsWith('$2')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);