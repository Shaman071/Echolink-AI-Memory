const { body } = require('express-validator');

// Password reset validation
const requestPasswordResetSchema = [
  body('email').isEmail().withMessage('Valid email required'),
];
const resetPasswordSchema = [
  body('token').notEmpty().withMessage('Token required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

// Email verification validation
const requestEmailVerificationSchema = [
  body('email').isEmail().withMessage('Valid email required'),
];
const verifyEmailSchema = [
  body('token').notEmpty().withMessage('Token required'),
];

module.exports = {
  requestPasswordResetSchema,
  resetPasswordSchema,
  requestEmailVerificationSchema,
  verifyEmailSchema,
};
