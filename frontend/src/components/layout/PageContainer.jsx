import React from 'react';
import PropTypes from 'prop-types';
import { cn } from '../../lib/utils';

function PageContainer({ 
  children, 
  className, 
  title, 
  description, 
  actions,
  breadcrumbItems = []
}) {
  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden', className)}>
      {/* Header with title and actions */}
      <div className="bg-background">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h1 className="text-2xl font-semibold text-foreground">
                  {title}
                </h1>
              )}
              {description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {actions}
            </div>
          </div>
          
          {/* Breadcrumb */}
          {breadcrumbItems.length > 0 && (
            <nav className="mt-2 flex" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2 text-sm">
                {breadcrumbItems.map((item, index) => (
                  <li key={index} className="flex items-center">
                    {index > 0 && (
                      <span className="text-muted-foreground mx-2">/</span>
                    )}
                    {item.href ? (
                      <a
                        href={item.href}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <span className="text-foreground font-medium">
                        {item.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </div>
      </div>
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto focus:outline-none">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}

PageContainer.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  title: PropTypes.string,
  description: PropTypes.string,
  actions: PropTypes.node,
  breadcrumbItems: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      href: PropTypes.string,
    })
  ),
};

export default PageContainer;
