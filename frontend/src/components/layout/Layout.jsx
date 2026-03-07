import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useState } from 'react';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onMenuClick={() => { }} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={true} onClose={() => { }} />

        <main className="flex-1 overflow-y-auto transition-all duration-300">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
