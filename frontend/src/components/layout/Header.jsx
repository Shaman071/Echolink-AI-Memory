import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Search, Bell, Menu, X } from 'lucide-react';

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();

  // Handle scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle search submission
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/query?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Mock notifications - in a real app, these would come from an API
  useEffect(() => {
    // Simulate fetching notifications
    const mockNotifications = [
      { id: 1, message: 'Your document has been processed', read: false, timestamp: '2 minutes ago', type: 'success' },
      { id: 2, message: 'New feature: Now with dark mode!', read: true, timestamp: '1 hour ago', type: 'info' },
      { id: 3, message: 'Your storage is 80% full', read: false, timestamp: '1 day ago', type: 'warning' },
    ];
    setNotifications(mockNotifications);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header 
      className={`sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-shadow ${
        isScrolled ? 'shadow-sm' : ''
      }`}
    >
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Left side - Logo and navigation */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenuClick}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <Link to="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold">E</span>
            </div>
            <span className="font-bold text-lg hidden sm:inline-block">Echolink</span>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-1">
            <Button variant="ghost" asChild>
              <Link to="/">Dashboard</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/query">Search</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/uploads">Uploads</Link>
            </Button>
          </nav>
        </div>
        
        {/* Center - Search */}
        <div className="flex-1 max-w-2xl px-4 hidden md:block">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search your knowledge base..."
              className="pl-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button 
              type="submit" 
              variant="ghost" 
              size="sm" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
            >
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
        
        {/* Right side - User and notifications */}
        <div className="flex items-center space-x-2">
          {/* Mobile search button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden"
            onClick={() => document.getElementById('mobile-search')?.focus()}
          >
            <Search className="h-5 w-5" />
          </Button>
          
          {/* Notifications */}
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Notifications"
            >
              <div className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
            </Button>
            
            {/* Notifications dropdown */}
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 mt-2 w-80 rounded-md border bg-popover p-2 shadow-lg z-50">
                  <div className="flex items-center justify-between p-2">
                    <h3 className="font-medium">Notifications</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowNotifications(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                      <div className="space-y-1">
                        {notifications.map((notification) => (
                          <div 
                            key={notification.id}
                            className={`p-3 rounded-md ${
                              !notification.read ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-accent'
                            }`}
                          >
                            <div className="flex items-start">
                              <div className="flex-1">
                                <p className="text-sm">{notification.message}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {notification.timestamp}
                                </p>
                              </div>
                              {!notification.read && (
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No new notifications
                      </div>
                    )}
                  </div>
                  <div className="border-t p-2 text-center">
                    <Button variant="ghost" size="sm">
                      View all notifications
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* User dropdown */}
          <div className="relative">
            <Button
              variant="ghost"
              className="h-10 w-10 rounded-full p-0"
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="User menu"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-medium">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            </Button>
            
            {/* User menu dropdown */}
            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-md border bg-popover p-2 shadow-lg z-50">
                  <div className="p-2">
                    <p className="text-sm font-medium">{user?.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email || 'user@example.com'}
                    </p>
                  </div>
                  <div className="border-t pt-1">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start"
                      asChild
                    >
                      <Link to="/settings">Settings</Link>
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start"
                      onClick={handleLogout}
                    >
                      Sign out
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile search bar */}
      <div className="md:hidden border-t px-4 py-2">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="mobile-search"
            type="search"
            placeholder="Search your knowledge base..."
            className="pl-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>
    </header>
  );
}
