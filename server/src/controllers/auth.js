const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.register = async (req, res) => {
  try {
    const { fullName, email, password, company } = req.body;
    
    if (!fullName || !email || !password || !company) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    
    const user = new User({
      fullName,
      email,
      passwordHash: password,
      role: 'recruiter',
      company
    });
    
    await user.save();
    console.log('User saved:', user._id);
    
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        company: user.company
      }
    });
    
  } catch (err) {
    console.error('REGISTER ERROR:', err.message);
    console.error(err.stack);
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Candidates apply directly through the job link.' });
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        company: user.company
      }
    });
    
  } catch (err) {
    console.error('LOGIN ERROR:', err.message);
    res.status(500).json({ message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    
    const userData = {
      _id: req.user._id || req.user.id,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      company: req.user.company,
      jobTitle: req.user.jobTitle,
      phone: req.user.phone,
      avatar: req.user.avatar,
      isActive: req.user.isActive,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt
    };
    
    res.json(userData);
    
  } catch (err) {
    console.error('getMe error:', err.message);
    res.status(500).json({ message: err.message });
  }
};
