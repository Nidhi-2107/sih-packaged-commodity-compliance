import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import InspectorDashboard from './pages/inspector/Dashboard';
import NewInspection from './pages/inspector/NewInspection';
import InspectionDetail from './pages/inspector/InspectionDetail';
import InspectionHistory from './pages/inspector/InspectionHistory';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminInspectors from './pages/admin/AdminInspectors';
import AdminInspections from './pages/admin/AdminInspections';
import AdminViolations from './pages/admin/AdminViolations';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminRules from './pages/admin/AdminRules';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAuditLog from './pages/admin/AdminAuditLog';

function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      
      {/* Inspector Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          {user?.role === 'admin' ? <Navigate to="/admin" replace /> : <InspectorDashboard />}
        </ProtectedRoute>
      } />
      <Route path="/inspection/new" element={
        <ProtectedRoute requiredRole="inspector"><NewInspection /></ProtectedRoute>
      } />
      <Route path="/inspection/:id" element={
        <ProtectedRoute><InspectionDetail /></ProtectedRoute>
      } />
      <Route path="/inspections" element={
        <ProtectedRoute requiredRole="inspector"><InspectionHistory /></ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="/admin/inspectors" element={
        <ProtectedRoute requiredRole="admin"><AdminInspectors /></ProtectedRoute>
      } />
      <Route path="/admin/inspections" element={
        <ProtectedRoute requiredRole="admin"><AdminInspections /></ProtectedRoute>
      } />
      <Route path="/admin/violations" element={
        <ProtectedRoute requiredRole="admin"><AdminViolations /></ProtectedRoute>
      } />
      <Route path="/admin/analytics" element={
        <ProtectedRoute requiredRole="admin"><AdminAnalytics /></ProtectedRoute>
      } />
      <Route path="/admin/rules" element={
        <ProtectedRoute requiredRole="admin"><AdminRules /></ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>
      } />
      <Route path="/admin/audit-logs" element={
        <ProtectedRoute requiredRole="admin"><AdminAuditLog /></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
