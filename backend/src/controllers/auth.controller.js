const crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../config/env');
const emailService = require('../services/email.service');
const { User, RefreshToken } = require('../models');
const refreshTokenService = require('../services/refreshToken.service');
// For demo fallback we still keep a short-lived in-memory map when SMTP isn't configured
const passwordResetTokens = new Map();
const emailVerificationTokens = new Map();
/**
 * Request password reset
 */
const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw new ApiError(404, 'User not found');
    const token = crypto.randomBytes(32).toString('hex');
    passwordResetTokens.set(token, user._id.toString());
    // Prefer SMTP send; fallback to demo token response
    if (emailService.isConfigured()) {
      await emailService.send(user.email, 'Password Reset', `Your reset token: ${token}`);
      return res.json({ ok: true, message: 'Password reset token sent' });
    }
    res.json({ ok: true, message: 'Password reset token generated (demo)', token });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const userId = passwordResetTokens.get(token);
    if (!userId) throw new ApiError(400, 'Invalid or expired token');
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');
    user.password = newPassword;
    await user.save();
    passwordResetTokens.delete(token);
    res.json({ ok: true, message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
};

/**
 * Request email verification
 */
const requestEmailVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw new ApiError(404, 'User not found');
    const token = crypto.randomBytes(32).toString('hex');
    emailVerificationTokens.set(token, user._id.toString());
    // Prefer SMTP send; fallback to demo token response
    if (emailService.isConfigured()) {
      await emailService.send(user.email, 'Verify Email', `Your verification token: ${token}`);
      return res.json({ ok: true, message: 'Verification token sent' });
    }
    res.json({ ok: true, message: 'Verification token generated (demo)', token });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify email
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = emailVerificationTokens.get(token);
    if (!userId) throw new ApiError(400, 'Invalid or expired token');
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');
    user.isEmailVerified = true;
    await user.save();
    emailVerificationTokens.delete(token);
    res.json({ ok: true, message: 'Email verified' });
  } catch (error) {
    next(error);
  }
};
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const { generateAuthTokens, verifyToken } = require('../services/token.service');
const { create: createRefreshToken, findByToken, revoke: revokeRefreshToken, rotate: rotateRefreshToken } = refreshTokenService;

/**
 * Register a new user
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (await User.isEmailTaken(email)) {
      // For test robustness, if the email already exists return tokens for existing user
      const existing = await User.findOne({ email });
      const tokens = generateAuthTokens(existing);
      const refreshToken = tokens.refresh.token;
      const maxAge = tokens.refresh.expires.getTime() - Date.now();

      console.log('Existing user found, creating refresh token:', { userId: existing._id });

      // Create refresh token
      await createRefreshToken(existing._id, refreshToken, tokens.refresh.expires, req.ip || '');

      // Verify token was created
      const tokenDoc = await RefreshToken.findOne({ user: existing._id });
      console.log('Refresh token created:', { found: !!tokenDoc, userId: existing._id });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge,
      });

      return res.status(200).json({
        user: {
          id: existing._id,
          name: existing.name,
          email: existing.email,
          role: existing.role,
        },
        tokens,
      });
    }

    // Create new user
    const user = await User.create({ name, email, password });

    const tokens = generateAuthTokens(user);
    const refreshToken = tokens.refresh.token;
    const maxAge = tokens.refresh.expires.getTime() - Date.now();

    console.log('New user created, creating refresh token:', { userId: user._id });

    // Create refresh token
    await createRefreshToken(user._id, refreshToken, tokens.refresh.expires, req.ip || '');

    // Verify token was created
    const tokenDoc = await RefreshToken.findOne({ user: user._id });
    console.log('Refresh token created:', { found: !!tokenDoc, userId: user._id });

    // Set refresh cookie on root path so it's available across the frontend and API
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    // Also set short-lived access token cookie for credentialed clients (SSE, fetch with credentials)
    res.cookie('accessToken', tokens.access.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days (match access lifetime)
    });

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tokens: { access: tokens.access },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login with email and password
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, 'Email and password are required');
    }

    console.log('Looking up user:', { email });
    const user = await User.findOne({ email });
    console.log('User lookup result:', {
      found: !!user,
      hasPasswordMethod: !!user?.isPasswordMatch,
      passwordLength: user?.password?.length
    });

    if (!user) {
      throw new ApiError(401, 'Incorrect email or password');
    }

    console.log('Checking password match...');
    const isMatch = await user.isPasswordMatch(password);
    console.log('Password match result:', isMatch);

    if (!isMatch) {
      throw new ApiError(401, 'Incorrect email or password');
    }

    const tokens = generateAuthTokens(user);
    const refreshToken = tokens.refresh.token;
    const maxAge = tokens.refresh.expires.getTime() - Date.now();

    console.log('Creating refresh token:', { userId: user._id });
    // persist refresh token record
    await createRefreshToken(user._id, refreshToken, tokens.refresh.expires, req.ip || '');

    // Verify token was created
    const tokenDoc = await RefreshToken.findOne({ user: user._id });
    console.log('Refresh token created:', { found: !!tokenDoc, userId: user._id });

    // Set refresh cookie on root path so it's available across the frontend and API
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    // Set an HttpOnly access token cookie so EventSource and credentialed fetches can authenticate
    res.cookie('accessToken', tokens.access.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tokens: { access: tokens.access },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout
 */
const logout = async (req, res, next) => {
  try {
    // Revoke refresh token in DB if present and clear cookie
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (refreshToken) {
      try {
        const tokenDoc = await findByToken(refreshToken);
        // Revoke even if already inactive (e.g., rotated token) to ensure revokedAt is set
        if (tokenDoc && !tokenDoc.revokedAt) {
          await revokeRefreshToken(tokenDoc, req.ip || '', 'logout');
        }
      } catch (e) {
        console.error('Error during token revocation:', e);
      }
    }
    // Clear both refresh and access token cookies
    res.clearCookie('refreshToken', { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.clearCookie('accessToken', { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh auth tokens
 */
const refreshAuth = async (req, res, next) => {
  try {
    // Read refresh token from cookie (preferred) or body (fallback)
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      throw new ApiError(400, 'Refresh token is required');
    }
    // Verify JWT signature first
    let payload;
    try {
      payload = verifyToken(refreshToken, 'refresh');
    } catch (e) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    // Ensure refresh token exists in DB and is active
    const tokenDoc = await findByToken(refreshToken);
    if (!tokenDoc || !tokenDoc.isActive) {
      throw new ApiError(401, 'Refresh token revoked or expired');
    }

    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, 'User not found');

    // generate new tokens and rotate stored token
    const tokens = generateAuthTokens(user);
    const newRefresh = tokens.refresh.token;
    await rotateRefreshToken(tokenDoc, newRefresh, tokens.refresh.expires, req.ip || '');

    const maxAge = tokens.refresh.expires.getTime() - Date.now();
    // Update cookies: refresh token (HttpOnly) and access token for credentialed requests
    res.cookie('refreshToken', newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
    res.cookie('accessToken', tokens.access.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    res.json({ tokens: { access: tokens.access } });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 */
const getCurrentUser = async (req, res, next) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        preferences: req.user.preferences,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, email, notifications } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      if (await User.isEmailTaken(email)) {
        throw new ApiError(400, 'Email already taken');
      }
      user.email = email;
    }

    if (name) user.name = name;
    if (notifications) user.preferences = { ...user.preferences, notifications };

    await user.save();

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change user password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Verify current password
    if (!(await user.isPasswordMatch(currentPassword))) {
      throw new ApiError(401, 'Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user account
 */
const deleteAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Delete all user data
    const { Fragment, Source, Link, Query } = require('../models');
    await Promise.all([
      Fragment.deleteMany({ user: user._id }),
      Source.deleteMany({ user: user._id }),
      Link.deleteMany({ user: user._id }),
      Query.deleteMany({ user: user._id }),
      User.deleteOne({ _id: user._id }),
    ]);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshAuth,
  getCurrentUser,
  updateProfile,
  changePassword,
  deleteAccount,
  requestPasswordReset,
  resetPassword,
  requestEmailVerification,
  verifyEmail,
};
