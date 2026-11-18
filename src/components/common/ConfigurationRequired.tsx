import React from 'react';
import { AlertTriangle, Key, Database, Terminal, ExternalLink } from 'lucide-react';

interface ConfigurationRequiredProps {
  title?: string;
  description?: string;
}

export const ConfigurationRequired: React.FC<ConfigurationRequiredProps> = ({
  title = 'Supabase Credentials Required',
  description = 'This application connects directly to Supabase for secure authentication, database persistence, image storage, and real-time messaging.',
}) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-amber-200 dark:border-amber-900/50 p-6 sm:p-8">
        <div className="flex items-center space-x-3 text-amber-600 dark:text-amber-400 mb-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-950/60 rounded-xl">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
          </div>
        </div>

        <div className="space-y-4 my-6">
          <div className="bg-slate-50 dark:bg-slate-900/80 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center mb-2">
              <Key className="w-4 h-4 mr-2 text-blue-600" />
              1. Add Environment Variables to <code className="mx-1 px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">.env</code>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              Copy <code className="text-xs font-mono">.env.example</code> to <code className="text-xs font-mono">.env</code> in the project root and fill in your values:
            </p>
            <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto leading-relaxed">
{`# Client-accessible keys (Frontend)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# Server-only key (Backend - never exposed in client bundle)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# Server settings
PORT=3001
FRONTEND_URL=http://localhost:5173`}
            </pre>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/80 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center mb-2">
              <Database className="w-4 h-4 mr-2 text-teal-600" />
              2. Run Database Migrations in Supabase Dashboard
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
              Go to your Supabase project's <strong>SQL Editor</strong> and execute in order:
            </p>
            <ul className="text-xs space-y-1 list-disc list-inside text-slate-700 dark:text-slate-300 font-mono">
              <li>supabase/migrations/001_init.sql</li>
              <li>supabase/migrations/002_campus_places.sql</li>
              <li>supabase/seed.sql (optional demo listings)</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
          <span className="flex items-center">
            <Terminal className="w-3.5 h-3.5 mr-1" />
            Restart dev server after saving your <code className="mx-1">.env</code>
          </span>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
          >
            Open Supabase Dashboard
            <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </a>
        </div>
      </div>
    </div>
  );
};

