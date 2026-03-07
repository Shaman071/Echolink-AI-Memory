import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  closeOnClickOutside = true,
  showCloseButton = true,
  size = 'md',
}) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full w-full m-4',
  };
  
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={closeOnClickOutside ? onClose : undefined}
          aria-hidden="true"
        />
        
        {/* Modal panel */}
        <div 
          className={cn(
            'relative z-10 w-full transform overflow-hidden rounded-lg bg-background p-6 text-left align-middle shadow-xl transition-all',
            sizeClasses[size],
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium leading-6 text-foreground">
              {title}
            </h3>
            {showCloseButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Content */}
          <div className="mt-2">
            {children}
          </div>
          
          {/* Footer - can be customized with children or use default close button */}
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Modal components for composition
const ModalHeader = ({ className, ...props }) => (
  <div
    className={cn(
      'flex flex-col space-y-2 text-center sm:text-left',
      className
    )}
    {...props}
  />
);

const ModalTitle = ({ className, ...props }) => (
  <h3
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
);

const ModalDescription = ({ className, ...props }) => (
  <p
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
);

const ModalContent = ({ className, ...props }) => (
  <div className={cn('mt-4', className)} {...props} />
);

const ModalFooter = ({
  className,
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  onCancel,
  onConfirm,
  isConfirmLoading = false,
  isConfirmDisabled = false,
  confirmVariant = 'default',
  showCancel = true,
  showConfirm = true,
  ...props
}) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6',
      className
    )}
    {...props}
  >
    {showCancel && (
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isConfirmLoading}
      >
        {cancelText}
      </Button>
    )}
    {showConfirm && (
      <Button
        type="button"
        variant={confirmVariant}
        onClick={onConfirm}
        disabled={isConfirmDisabled || isConfirmLoading}
        className={showCancel ? 'sm:ml-2' : ''}
      >
        {isConfirmLoading ? 'Loading...' : confirmText}
      </Button>
    )}
  </div>
);

export {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalContent,
  ModalFooter,
};
