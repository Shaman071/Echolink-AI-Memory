/**
 * Validation utilities for input safety and security
 */

/**
 * Sanitize user input to prevent XSS and injection attacks
 * @param {string} input - User input string
 * @returns {string} - Sanitized string
 */
export function sanitizeInput(input) {
    if (typeof input !== 'string') return '';

    return input
        .replace(/[<>]/g, '') // Remove < and >
        .trim()
        .substring(0, 10000); // Max length
}

/**
 * Validate query string
 * @param {string} query - Search query
 * @returns {Object} - Validation result
 */
export function validateQuery(query) {
    if (!query || typeof query !== 'string') {
        return {
            valid: false,
            error: 'Query is required',
        };
    }

    const trimmed = query.trim();

    if (trimmed.length === 0) {
        return {
            valid: false,
            error: 'Query cannot be empty',
        };
    }

    if (trimmed.length < 2) {
        return {
            valid: false,
            error: 'Query must be at least 2 characters',
        };
    }

    if (trimmed.length > 500) {
        return {
            valid: false,
            error: 'Query is too long (max 500 characters)',
        };
    }

    // Check for potential prompt injection patterns
    const suspiciousPatterns = [
        /ignore\s+(all\s+)?previous\s+instructions/i,
        /system\s*:|<\|system\|>/i,
        /you\s+are\s+(now\s+)?a\s+/i,
        /\/\*\s*important/i,
    ];

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(trimmed)) {
            return {
                valid: false,
                error: 'Query contains suspicious content',
                warning: 'Possible prompt injection detected',
            };
        }
    }

    return {
        valid: true,
        sanitized: sanitizeInput(trimmed),
    };
}

/**
 * Validate file for upload
 * @param {File} file - File object
 * @returns {Object} - Validation result
 */
export function validateFile(file) {
    if (!file) {
        return {
            valid: false,
            error: 'No file selected',
        };
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const ALLOWED_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown',
        'image/png',
        'image/jpeg',
        'image/jpg',
    ];

    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File is too large (max 50MB). Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
        };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: `File type not allowed: ${file.type}. Allowed types: PDF, DOCX, TXT, MD, PNG, JPG`,
        };
    }

    // Check file name for suspicious patterns
    const suspiciousExtensions = /\.(exe|bat|sh|cmd|ps1|vbs|js|msi|dll)$/i;
    if (suspiciousExtensions.test(file.name)) {
        return {
            valid: false,
            error: 'File extension not allowed for security reasons',
        };
    }

    return {
        valid: true,
        file,
    };
}

/**
 * Validate email address
 * @param {string} email - Email address
 * @returns {Object} - Validation result
 */
export function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return {
            valid: false,
            error: 'Email is required',
        };
    }

    const trimmed = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
        return {
            valid: false,
            error: 'Invalid email address',
        };
    }

    return {
        valid: true,
        email: trimmed.toLowerCase(),
    };
}

/**
 * Validate password strength
 * @param {string} password - Password string
 * @returns {Object} - Validation result
 */
export function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return {
            valid: false,
            error: 'Password is required',
        };
    }

    if (password.length < 8) {
        return {
            valid: false,
            error: 'Password must be at least 8 characters',
        };
    }

    if (password.length > 128) {
        return {
            valid: false,
            error: 'Password is too long (max 128 characters)',
        };
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const strength = [hasUpperCase, hasLowerCase, hasNumber, hasSpecial].filter(Boolean).length;

    if (strength < 3) {
        return {
            valid: false,
            error: 'Password must contain at least 3 of: uppercase, lowercase, number, special character',
            strength: strength * 25,
        };
    }

    return {
        valid: true,
        strength: strength * 25,
    };
}

/**
 * Validate text field (general purpose)
 * @param {string} text - Text input
 * @param {Object} options - Validation options
 * @returns {Object} - Validation result
 */
export function validateTextField(text, options = {}) {
    const {
        required = false,
        minLength = 0,
        maxLength = 1000,
        fieldName = 'Field',
    } = options;

    if (!text || typeof text !== 'string') {
        if (required) {
            return {
                valid: false,
                error: `${fieldName} is required`,
            };
        }
        return { valid: true, value: '' };
    }

    const trimmed = text.trim();

    if (required && trimmed.length === 0) {
        return {
            valid: false,
            error: `${fieldName} cannot be empty`,
        };
    }

    if (trimmed.length < minLength) {
        return {
            valid: false,
            error: `${fieldName} must be at least ${minLength} characters`,
        };
    }

    if (trimmed.length > maxLength) {
        return {
            valid: false,
            error: `${fieldName} is too long (max ${maxLength} characters)`,
        };
    }

    return {
        valid: true,
        value: sanitizeInput(trimmed),
    };
}

export default {
    sanitizeInput,
    validateQuery,
    validateFile,
    validateEmail,
    validatePassword,
    validateTextField,
};
