import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Upload, Settings, Link as LinkIcon, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { name: 'Dashboard', icon: Home, href: '/' },
  { name: 'Search', icon: Search, href: '/query' },
  { name: 'Uploads', icon: Upload, href: '/uploads' },
  { name: 'Links', icon: LinkIcon, href: '/links' },
  { name: 'Admin', icon: ShieldCheck, href: '/admin' },
  { name: 'Settings', icon: Settings, href: '/settings' },
];

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className={cn(
      'relative z-40 w-64 bg-background border-r border-border transition-transform duration-300 ease-in-out',
      'translate-x-0',
      'block shrink-0',
    )}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-border">
          <div className="h-8 w-8 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center mr-2">
            <span className="text-white font-bold">E</span>
          </div>
          <span className="font-bold text-lg text-foreground">Echolink</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-primary/20 text-primary'
                    : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                  'group'
                )}
                onClick={onClose}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center">
            <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-medium text-sm">
              {initials}
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
