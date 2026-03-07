import React, { useState, useRef, useEffect } from 'react';
import { Search, Send, Loader2, Sparkles, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';

export default function QueryBox({
  onSubmit,
  isLoading = false,
  placeholder = 'Ask a question or search your knowledge base...',
  autoFocus = true,
  initialValue = '',
  showSuggestions = true,
  className = '',
  onClear,
}) {
  const [query, setQuery] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);

  const suggestions = [
    'What are the key points from my recent documents?',
    'Show me all documents related to project X',
    'What were the action items from the last meeting?',
    'Find research papers about machine learning',
  ];

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      // if the imported Textarea supports forwarded ref, this will focus correctly
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSubmit(query);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    // Auto-submit when clicking a suggestion
    if (onSubmit) {
      onSubmit(suggestion);
    }
  };

  const handleClear = () => {
    setQuery('');
    if (onClear) {
      onClear();
    }
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className={`w-full max-w-3xl mx-auto ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div
          className="relative
          flex items-center
          rounded-lg border border-input bg-background
          focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2
          transition-shadow duration-200
          shadow-sm hover:shadow-md
          overflow-hidden
        "
        >
          <div className="absolute left-3 text-muted-foreground">
            <Search className="h-5 w-5" />
          </div>

          <Textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={placeholder}
            className="min-h-[60px] max-h-40 py-4 pl-10 pr-16 resize-none
                     border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={1}
            disabled={isLoading}
          />

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-12 text-muted-foreground hover:text-foreground transition-colors"
              disabled={isLoading}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Clear</span>
            </button>
          )}

          <Button
            type="submit"
            size="icon"
            className="absolute right-2 h-10 w-10"
            disabled={!query.trim() || isLoading}
            variant={isLoading ? 'ghost' : 'default'}
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            <span className="sr-only">Search</span>
          </Button>
        </div>

        {showSuggestions && isFocused && !query && (
          <div className="mt-2">
            <div className="flex items-center text-xs text-muted-foreground mb-2">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              <span>Try asking...</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-accent text-foreground/80 hover:text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
