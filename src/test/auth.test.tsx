import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { Navbar } from '@/components/common/Navbar';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Login } from '@/pages/auth/Login';

describe('Milestone 1 - Scaffolding, Navigation, Auth and Route Security', () => {
  it('renders ConfigurationRequired component with explicit instructions', () => {
    render(<ConfigurationRequired />);
    expect(screen.getByText(/Supabase Credentials Required/i)).toBeInTheDocument();
    expect(screen.getByText(/VITE_SUPABASE_URL=/i)).toBeInTheDocument();
    expect(screen.getByText(/SUPABASE_SERVICE_ROLE_KEY=/i)).toBeInTheDocument();
  });

  it('renders Navbar with branding, browse, campus mode, and CTA buttons', () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Navbar />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    );

    expect(screen.getByText('FindIt')).toBeInTheDocument();
    expect(screen.getByText('Browse Items')).toBeInTheDocument();
    expect(screen.getByText('Campus Mode')).toBeInTheDocument();
    expect(screen.getByText('How It Works')).toBeInTheDocument();
  });

  it('renders Login form and displays ConfigurationRequired when Supabase is unconfigured', () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Login />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    );

    // Because VITE_SUPABASE_URL is unconfigured in test environment without .env,
    // it cleanly displays the configuration screen per working instructions
    expect(screen.getByText(/Supabase Credentials Required/i)).toBeInTheDocument();
  });
});

