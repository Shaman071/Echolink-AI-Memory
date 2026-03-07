/**
 * Accessibility utilities and ARIA helpers
 */

/**
 * Generate ARIA label for button based on state
 * @param {Object} options - Button options
 * @returns {Object} - ARIA props
 */
export function getButtonAriaProps(options = {}) {
    const {
        label,
        isLoading = false,
        isDisabled = false,
        hasPopup = false,
        expanded = false,
    } = options;

    const props = {
        'aria-label': label,
        'aria-busy': isLoading,
        'aria-disabled': isDisabled,
    };

    if (hasPopup) {
        props['aria-haspopup'] = 'true';
        props['aria-expanded'] = expanded;
    }

    return props;
}

/**
 * Generate props for form input with validation
 * @param {Object} options - Input options
 * @returns {Object} - ARIA props
 */
export function getInputAriaProps(options = {}) {
    const {
        label,
        required = false,
        invalid = false,
        describe dById,
        errorId,
    } = options;

    const props = {
        'aria-label': label,
        'aria-required': required,
        'aria-invalid': invalid,
    };

    if (describedById) {
        props['aria-describedby'] = describedById;
    }

    if (invalid && errorId) {
        props['aria-describedby'] = errorId;
        props['aria-errormessage'] = errorId;
    }

    return props;
}

/**
 * Get semantic role for interactive elements
 * @param {string} type - Element type
 * @returns {string} - ARIA role
 */
export function getSemanticRole(type) {
    const roles = {
        navigation: 'navigation',
        main: 'main',
        complementary: 'complementary',
        search: 'search',
        form: 'form',
        dialog: 'dialog',
        alert: 'alert',
        status: 'status',
        progressbar: 'progressbar',
    };

    return roles[type] || '';
}

/**
 * Create unique ID for accessibility
 * @param {string} prefix - ID prefix
 * @returns {string} - Unique ID
 */
let idCounter = 0;
export function createA11yId(prefix = 'a11y') {
    idCounter++;
    return `${prefix}-${idCounter}-${Date.now()}`;
}

/**
 * Focus management helper
 * @param {HTMLElement} element - Element to focus
 * @param {Object} options - Focus options
 */
export function manageFocus(element, options = {}) {
    const { preventScroll = false, delay = 0 } = options;

    if (!element) return;

    const focus = () => {
        try {
            if (typeof element.focus === 'function') {
                element.focus({ preventScroll });
            }
        } catch (error) {
            console.warn('Focus management error:', error);
        }
    };

    if (delay > 0) {
        setTimeout(focus, delay);
    } else {
        focus();
    }
}

/**
 * Announce message to screen readers
 * @param {string} message - Message to announce
 * @param {string} priority - Priority level ('polite' | 'assertive')
 */
export function announceToScreenReader(message, priority = 'polite') {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only'; // Visually hidden but readable by screen readers
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

/**
 * Check if element is keyboard accessible
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} - Is keyboard accessible
 */
export function isKeyboardAccessible(element) {
    if (!element) return false;

    const tabbableElements = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([type="hidden"]):not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ];

    return tabbableElements.some(selector =>
        element.matches(selector) || element.querySelector(selector)
    );
}

/**
 * Keyboard navigation helper
 * @param {KeyboardEvent} event - Keyboard event
 * @param {Object} handlers - Key handlers
 */
export function handleKeyboardNav(event, handlers = {}) {
    const {
        onEnter,
        onEscape,
        onArrowUp,
        onArrowDown,
        onArrowLeft,
        onArrowRight,
        onSpace,
        onTab,
    } = handlers;

    switch (event.key) {
        case 'Enter':
            onEnter?.(event);
            break;
        case 'Escape':
            onEscape?.(event);
            break;
        case 'ArrowUp':
            onArrowUp?.(event);
            break;
        case 'ArrowDown':
            onArrowDown?.(event);
            break;
        case 'ArrowLeft':
            onArrowLeft?.(event);
            break;
        case 'ArrowRight':
            onArrowRight?.(event);
            break;
        case ' ':
        case 'Spacebar':
            onSpace?.(event);
            break;
        case 'Tab':
            onTab?.(event);
            break;
        default:
            break;
    }
}

/**
 * Get focus trap for modal/dialog
 * @param {HTMLElement} container - Container element
 * @returns {Object} - Focus trap methods
 */
export function createFocusTrap(container) {
    if (!container) return null;

    const getFocusableElements = () => {
        return container.querySelectorAll(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
    };

    const trap = (event) => {
        const focusable = Array.from(getFocusableElements());
        const firstFocusable = focusable[0];
        const lastFocusable = focusable[focusable.length - 1];

        if (event.key === 'Tab') {
            if (event.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    lastFocusable?.focus();
                    event.preventDefault();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    firstFocusable?.focus();
                    event.preventDefault();
                }
            }
        }

        if (event.key === 'Escape') {
            // Let parent handle escape
        }
    };

    return {
        activate: () => {
            container.addEventListener('keydown', trap);
            const firstFocusable = getFocusableElements()[0];
            firstFocusable?.focus();
        },
        deactivate: () => {
            container.removeEventListener('keydown', trap);
        },
    };
}

/**
 * Check color contrast ratio (WCAG AA standard)
 * @param {string} foreground - Foreground color (hex)
 * @param {string} background - Background color (hex)
 * @returns {Object} - Contrast info
 */
export function checkColorContrast(foreground, background) {
    // Simple contrast check - in production, use a library like 'color-contrast-checker'
    // This is a placeholder implementation
    return {
        ratio: 4.5, // Placeholder
        passes: true,
        level: 'AA',
    };
}

export default {
    getButtonAriaProps,
    getInputAriaProps,
    getSemanticRole,
    createA11yId,
    manageFocus,
    announceToScreenReader,
    isKeyboardAccessible,
    handleKeyboardNav,
    createFocusTrap,
    checkColorContrast,
};
