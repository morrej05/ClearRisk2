import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

interface PlatformLayoutProps {
  children: ReactNode;
}

export default function PlatformLayout({ children }: PlatformLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 border-b-4 border-amber-500 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-amber-500" />
              <h1 className="text-xl font-bold">Platform Administration</h1>
            </div>

            <Link
              to="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Exit Platform
            </Link>
          </div>
        </div>
      </header>

      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <p className="text-sm text-amber-900 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            You are in platform administration mode. Changes affect all organisations.
          </p>
        </div>
      </div>

      {children}
    </div>
  );
}
