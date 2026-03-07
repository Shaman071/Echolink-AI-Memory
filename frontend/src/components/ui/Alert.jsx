import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:text-foreground [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:translate-y-[-3px] [&:has(svg)]:pl-11',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive: 'text-destructive border-destructive/50 dark:border-destructive [&>svg]:text-destructive text-destructive',
        success: 'border-green-500/50 text-green-600 dark:text-green-400 [&>svg]:text-green-500',
        warning: 'border-amber-500/50 text-amber-600 dark:text-amber-400 [&>svg]:text-amber-500',
        info: 'border-blue-500/50 text-blue-600 dark:text-blue-400 [&>svg]:text-blue-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Alert = React.forwardRef(({ className, variant, ...props }, ref) => {
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
});
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

// Alert with icon
const AlertWithIcon = React.forwardRef(({ 
  variant = 'default', 
  title, 
  children, 
  className, 
  showIcon = true,
  onDismiss,
  ...props 
}, ref) => {
  const Icon = {
    default: Info,
    destructive: AlertCircle,
    success: CheckCircle,
    warning: AlertTriangle,
    info: Info,
  }[variant] || Info;

  return (
    <Alert
      ref={ref}
      variant={variant}
      className={cn('relative pr-10', className)}
      {...props}
    >
      {showIcon && <Icon className="h-5 w-5" />}
      <div>
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertDescription>{children}</AlertDescription>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </button>
      )}
    </Alert>
  );
});
AlertWithIcon.displayName = 'AlertWithIcon';

export { Alert, AlertTitle, AlertDescription, AlertWithIcon };
