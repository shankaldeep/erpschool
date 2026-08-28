import React from 'react';
import { StoreProvider, useStore } from './store';
import { Login } from './pages/Login';
import { DashboardLayout } from './components/DashboardLayout';
import { AdminPanel } from './pages/AdminPanel';
import { TeacherPanel } from './pages/TeacherPanel';
import { StudentPanel } from './pages/StudentPanel';
import { ClerkPanel } from './pages/ClerkPanel';
import { MasterAdminPanel } from './pages/MasterAdminPanel';
import { ParentPanel } from './pages/ParentPanel';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const { currentUser, schools } = useStore();

  if (!currentUser) {
    return <Login />;
  }

  // If Master Admin, allow direct access even if schools are empty
  if (schools.length === 0 && currentUser.role !== 'MASTER_ADMIN') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 space-y-3 p-4 text-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-600 tracking-wider uppercase">Loading Workspace...</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline"
        >
          Taking too long? Click here to refresh
        </button>
      </div>
    );
  }

  const getDashboardTitle = () => {
    switch (currentUser.role) {
      case 'MASTER_ADMIN': return 'Super Administrator Console';
      case 'ADMIN': return 'School Admin Dashboard';
      case 'TEACHER': return 'Teacher Dashboard';
      case 'STUDENT': return 'Student Portal';
      case 'CLERK': return 'Fee Management (Clerk)';
      case 'PARENT': return 'Parent Portal';
      default: return 'Dashboard';
    }
  };
  
  const currentSchool = schools.find(s => s.id === currentUser.schoolId);
  const titleString = currentSchool ? `${getDashboardTitle()} - ${currentSchool.name}` : getDashboardTitle();

  return (
    <DashboardLayout title={titleString}>
      {currentUser.role === 'MASTER_ADMIN' && <MasterAdminPanel />}
      {currentUser.role === 'ADMIN' && <AdminPanel />}
      {currentUser.role === 'TEACHER' && <TeacherPanel />}
      {currentUser.role === 'STUDENT' && <StudentPanel />}
      {currentUser.role === 'CLERK' && <ClerkPanel />}
      {currentUser.role === 'PARENT' && <ParentPanel />}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </ErrorBoundary>
  );
}

