import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from '@/components/common/Navbar';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Login } from '@/pages/auth/Login';

// Mock useAuth
vi.mock('@/contexts/AuthContext', async () => {
  const actual = await vi.importActual<any>('@/contexts/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

describe('Milestone 1 - Scaffolding, Navigation, Auth and Route Security', () => {
  const mockSignIn = vi.fn();
  const mockResendVerificationEmail = vi.fn();
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      isAuthenticated: false,
      isAdmin: false,
      isConfigured: true,
      signIn: mockSignIn,
      signOut: mockSignOut,
      resendVerificationEmail: mockResendVerificationEmail,
    });
  });

  it('renders ConfigurationRequired component with explicit instructions', () => {
    render(<ConfigurationRequired />);
    expect(screen.getByText(/Supabase Credentials Required/i)).toBeInTheDocument();
    expect(screen.getByText(/VITE_SUPABASE_URL=/i)).toBeInTheDocument();
    expect(screen.getByText(/SUPABASE_SERVICE_ROLE_KEY=/i)).toBeInTheDocument();
  });

  it('renders Navbar with branding, browse, campus mode, and CTA buttons', () => {
    render(
      <ThemeProvider>
        <BrowserRouter>
          <Navbar />
        </BrowserRouter>
      </ThemeProvider>
    );

    expect(screen.getByText('FindIt')).toBeInTheDocument();
    expect(screen.getByText('Browse Items')).toBeInTheDocument();
    expect(screen.getByText('Campus Mode')).toBeInTheDocument();
    expect(screen.getByText('How It Works')).toBeInTheDocument();
    expect(screen.getByText('Log In')).toBeInTheDocument();
  });

  it('renders Login form and displays ConfigurationRequired when Supabase is unconfigured', () => {
    (useAuth as any).mockReturnValue({
      isConfigured: false,
      isLoading: false,
      isAuthenticated: false,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText(/Supabase Credentials Required/i)).toBeInTheDocument();
  });

  describe('Login Form Validation & Authentication Flow', () => {
    it('shows inline validation errors for empty fields, invalid email format, and short password', async () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );

      const submitButton = screen.getByRole('button', { name: /log in/i });

      // 1. Submit empty form
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
      });

      // 2. Invalid email format
      const emailInput = screen.getByPlaceholderText('you@example.com');
      fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
      });

      // 3. Short password under 8 characters
      const passwordInput = screen.getByPlaceholderText('••••••••');
      fireEvent.change(passwordInput, { target: { value: '12345' } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('successfully calls signIn and navigates on valid credentials', async () => {
      mockSignIn.mockResolvedValueOnce({ error: null });

      let currentPath = '/login';
      const LocationTracker = () => {
        const loc = useLocation();
        currentPath = loc.pathname;
        return <span data-testid="location">{loc.pathname}</span>;
      };

      render(
        <MemoryRouter initialEntries={['/login']}>
          <LocationTracker />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Routes>
        </MemoryRouter>
      );

      const emailInput = screen.getByPlaceholderText('you@example.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /log in/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('user@example.com', 'password123');
      });

      await waitFor(() => {
        expect(currentPath).toBe('/dashboard');
      });
    });

    it('displays friendly "Incorrect email or password." error when credentials fail', async () => {
      mockSignIn.mockResolvedValueOnce({
        error: new Error('Invalid login credentials'),
      });

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );

      const emailInput = screen.getByPlaceholderText('you@example.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /log in/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Incorrect email or password.');
      });
    });

    it('displays "Please verify your email first." with a resend button when email is unverified', async () => {
      mockSignIn.mockResolvedValueOnce({
        error: new Error('Email not confirmed'),
      });
      mockResendVerificationEmail.mockResolvedValueOnce({ error: null });

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );

      const emailInput = screen.getByPlaceholderText('you@example.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /log in/i });

      fireEvent.change(emailInput, { target: { value: 'unverified@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please verify your email first.')).toBeInTheDocument();
      });

      const resendBtn = screen.getByRole('button', { name: /resend verification email/i });
      expect(resendBtn).toBeInTheDocument();

      fireEvent.click(resendBtn);

      await waitFor(() => {
        expect(mockResendVerificationEmail).toHaveBeenCalledWith('unverified@example.com');
      });
    });

    it('toggles password visibility with aria-label when eye button is clicked', () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );

      const passwordInput = screen.getByPlaceholderText('••••••••');
      const toggleButton = screen.getByLabelText(/show password/i);

      expect(passwordInput).toHaveAttribute('type', 'password');

      fireEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(screen.getByLabelText(/hide password/i)).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText(/hide password/i));
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('ProtectedRoute Redirection', () => {
    it('redirects unauthenticated users to /login preserving the requested path in location.state', () => {
      (useAuth as any).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        isConfigured: true,
        user: null,
      });

      let redirectedState: any = null;
      const LoginCapture = () => {
        const location = useLocation();
        redirectedState = location.state;
        return <div>Login Page Reached</div>;
      };

      render(
        <MemoryRouter initialEntries={['/dashboard/reports']}>
          <Routes>
            <Route path="/login" element={<LoginCapture />} />
            <Route
              path="/dashboard/reports"
              element={
                <ProtectedRoute>
                  <div>Secret Reports</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Login Page Reached')).toBeInTheDocument();
      expect(screen.queryByText('Secret Reports')).not.toBeInTheDocument();
      expect(redirectedState).toEqual({
        from: expect.objectContaining({ pathname: '/dashboard/reports' }),
      });
    });
  });
});
