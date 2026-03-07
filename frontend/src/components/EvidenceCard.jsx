import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from './ui/Button';

export default function EvidenceCard({ 
  title, 
  content, 
  source,
  sender = 'Unknown',
  datetime = new Date(),
  relevance = 0.85,
  onOpen,
  onClick,
  highlighted = false,
  className = '',
  ...props 
}) {
  // Get initials from sender name
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format relevance as percentage
  const relevancePercentage = Math.round(relevance * 100);
  
  // Format datetime
  const formattedDateTime = new Date(datetime).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const initials = getInitials(sender);

  return (
    <div 
      className={`bg-card border rounded-lg overflow-hidden transition-all hover:shadow-md ${highlighted ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-950' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      {...props}
    >
      <div className="p-4">
        {/* Header with avatar and relevance */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Avatar with initials */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">
                {initials}
              </span>
            </div>
            
            {/* Sender name and datetime */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {sender}
              </p>
              <p className="text-xs text-muted-foreground">
                {formattedDateTime}
              </p>
            </div>
          </div>

          {/* Relevance badge */}
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex-shrink-0">
            {relevancePercentage}%
          </span>
        </div>
        
        {/* Content snippet */}
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3 leading-relaxed">
          {content}
        </p>
        
        {/* Footer with Open button */}
        <div className="flex justify-end pt-2 border-t">
          <Button 
            variant="outline" 
            size="sm"
            onClick={onOpen}
            className="h-8 text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Open
          </Button>
        </div>
      </div>
    </div>
  );
}
