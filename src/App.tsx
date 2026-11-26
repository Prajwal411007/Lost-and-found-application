import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { LocationPermissionDialog } from '@/components/common/LocationPermissionDialog';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRoute } from '@/components/auth/AdminRoute';

// Pages
import { Home } from '@/pages/Home';
import { Login } from '@/pages/auth/Login';
import { Signup } from '@/pages/auth/Signup';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { ResetPassword } from '@/pages/auth/ResetPassword';
import { AuthCallback } from '@/pages/auth/AuthCallback';
import { ProfilePage } from '@/pages/auth/Profile';
import { HowItWorksPage } from '@/pages/info/HowItWorks';
import { PrivacyPage } from '@/pages/info/Privacy';
import { TermsPage } from '@/pages/info/Terms';
import { ContactPage } from '@/pages/info/Contact';
import { HelpPage } from '@/pages/info/Help';

// Lazy loaded feature pages
const BrowsePage = lazy(() => import('@/pages/items/Browse').then(m => ({ default: m.BrowsePage })));
const ItemDetailsPage = lazy(() => import('@/pages/items/ItemDetails').then(m => ({ default: m.ItemDetailsPage })));
const ReportItemPage = lazy(() => import('@/pages/items/ReportItem').then(m => ({ default: m.ReportItemPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard/Dashboard').then(m => ({ default: m.DashboardPage })));
const MessagesPage = lazy(() => import('@/pages/messages/Messages').then(m => ({ default: m.MessagesPage })));
const AdminPage = lazy(() => import('@/pages/admin/Admin').then(m => ({ default: m.AdminPage })));
const CampusPage = lazy(() => import('@/pages/campus/Campus').then(m => ({ default: m.CampusPage })));
const MyItemsPage = lazy(() => import('@/pages/items/MyItems').then(m => ({ default: m.MyItemsPage })));
const PublicTagPage = lazy(() => import('@/pages/items/PublicTag').then(m => ({ default: m.PublicTagPage })));
const InsightsPage = lazy(() => import('@/pages/info/Insights').then(m => ({ default: m.InsightsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <LocationProvider>
            <BrowserRouter>
              <LocationPermissionDialog />
              <div className="flex flex-col min-h-screen bg-transparent text-slate-900 dark:text-slate-100 transition-colors duration-200">
              <Navbar />
              <main className="flex-1">
                <ErrorBoundary>
                  <Suspense
                    fallback={
                      <div className="min-h-[50vh] flex items-center justify-center">
                        <LoadingSpinner size="lg" message="Loading..." />
                      </div>
                    }
                  >
                    <Routes>
                      {/* Public Core Routes */}
                      <Route path="/" element={<Home />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/auth/callback" element={<AuthCallback />} />
                      <Route path="/how-it-works" element={<HowItWorksPage />} />
                      <Route path="/privacy" element={<PrivacyPage />} />
                      <Route path="/terms" element={<TermsPage />} />
                      <Route path="/contact" element={<ContactPage />} />
                      <Route path="/help" element={<HelpPage />} />
                      <Route path="/insights" element={<InsightsPage />} />

                      {/* Browse & Items */}
                      <Route path="/browse" element={<BrowsePage />} />
                      <Route path="/items/:id" element={<ItemDetailsPage />} />
                      <Route path="/tag/:code" element={<PublicTagPage />} />

                      {/* Protected Reports */}
                      <Route
                        path="/report/lost"
                        element={
                          <ProtectedRoute>
                            <ReportItemPage initialType="lost" />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/report/found"
                        element={
                          <ProtectedRoute>
                            <ReportItemPage initialType="found" />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/items/:id/edit"
                        element={
                          <ProtectedRoute>
                            <ReportItemPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Protected Dashboard & Messages */}
                      <Route
                        path="/my-items"
                        element={
                          <ProtectedRoute>
                            <MyItemsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/dashboard"
                        element={
                          <ProtectedRoute>
                            <DashboardPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/messages"
                        element={
                          <ProtectedRoute>
                            <MessagesPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/profile"
                        element={
                          <ProtectedRoute>
                            <ProfilePage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Campus Mode */}
                      <Route path="/campus" element={<CampusPage />} />

                      {/* Admin Route */}
                      <Route
                        path="/admin"
                        element={
                          <AdminRoute>
                            <AdminPage />
                          </AdminRoute>
                        }
                      />

                      {/* Fallback */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </main>
              <Footer />
            </div>
          </BrowserRouter>
        </LocationProvider>
      </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

