const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { toJSON, paginate } = require('./plugins');

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      validate: {
        validator: function(v) {
          return v && v.length >= 8;
        },
        message: 'Password must be at least 8 characters long and not empty'
      },
      private: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    preferences: {
      localFirst: {
        type: Boolean,
        default: false,
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system',
      },
      encryptionEnabled: {
        type: Boolean,
        default: false,
      },
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },
        push: {
          type: Boolean,
          default: true,
        },
      },
    },
    encryptionKeyMeta: {
      salt: String,
      method: {
        type: String,
        default: 'AES-GCM',
      },
      keyDerivation: {
        type: String,
        default: 'PBKDF2',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Add plugins
userSchema.plugin(toJSON);
userSchema.plugin(paginate);

/**
 * Check if email is taken
 * @param {string} email - The user's email
 * @param {ObjectId} [excludeUserId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
userSchema.statics.isEmailTaken = async function (email, excludeUserId) {
  const user = await this.findOne({ email, _id: { $ne: excludeUserId } });
  return !!user;
};

/**
 * Delete user by id (alias used by tests)
 * @param {ObjectId|string} id
 * @returns {Promise}
 */
userSchema.statics.deleteById = async function (id) {
  return this.findByIdAndDelete(id);
};

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
userSchema.methods.isPasswordMatch = async function (password) {
  const user = this;
  if (!password || !user.password) {
    console.error('Missing password:', { password: !!password, userPassword: !!user.password });
    return false;
  }
  try {
    console.log('Comparing passwords:', { 
      hashedLength: user.password.length,
      plainLength: password.length,
    });
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password comparison result:', isMatch);
    return isMatch;
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

userSchema.pre('save', async function (next) {
  const user = this;
  if (user.isModified('password')) {
    console.log('Password modified, hashing password:', {
      passwordLength: user.password?.length,
      isNew: this.isNew,
    });

    if (!user.password) {
      console.error('Password is missing during save');
      next(new Error('Password is required'));
      return;
    }

    try {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      console.log('Password hashed:', { 
        originalLength: user.password.length,
        hashedLength: hashedPassword.length 
      });
      user.password = hashedPassword;
    } catch (error) {
      console.error('Password hashing error:', error);
      next(error);
      return;
    }
  }
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
