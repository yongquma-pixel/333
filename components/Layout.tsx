import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Map, Home, BookOpen, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden border-x border-gray-200">
      {/* Header */}
      <header className="bg-brand-600 text-white p-4 shadow-md z-10 sticky top-0">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <Map className="w-6 h-6" />
            <span className="text-xl font-bold tracking-wide">路区通</span>
          </Link>
          <span className="text-xs bg-brand-700 px-2 py-1 rounded">快递助手</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-20">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="bg-white border-t border-gray-200 fixed bottom-0 w-full max-w-md flex justify-around py-3 pb-safe z-20">
        <Link to="/" className={`flex flex-col items-center space-y-1 ${isActive('/') ? 'text-brand-600' : 'text-gray-400'}`}>
          <Home className="w-6 h-6" />
          <span className="text-xs">首页</span>
        </Link>
        <Link to="/practice" className={`flex flex-col items-center space-y-1 ${isActive('/practice') || isActive('/quiz') ? 'text-brand-600' : 'text-gray-400'}`}>
          <BookOpen className="w-6 h-6" />
          <span className="text-xs">练习</span>
        </Link>
        <Link to="/manage" className={`flex flex-col items-center space-y-1 ${isActive('/manage') ? 'text-brand-600' : 'text-gray-400'}`}>
          <Settings className="w-6 h-6" />
          <span className="text-xs">管理</span>
        </Link>
      </nav>
    </div>
  );
};