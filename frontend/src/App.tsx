import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SystemConfigProvider } from '@/context/SystemConfigContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';

// Auth Pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { ProfilePage } from '@/pages/auth/ProfilePage';
import { UserManagementPage } from '@/pages/admin/UserManagementPage';

// Admin / Lookups
import { LookupTypePage } from '@/pages/admin/LookupTypePage';
import { LookupPage } from '@/pages/admin/LookupPage';
import { UserActivityPage } from '@/pages/admin/UserActivityPage';
import { SystemConfigPage } from '@/pages/admin/SystemConfigPage';

// Question Bank
import { QuestionSetsPage } from '@/pages/questions/QuestionSetsPage';
import { QuestionMCQPage } from '@/pages/questions/QuestionMCQPage';
import { QuestionNarrativePage } from '@/pages/questions/QuestionNarrativePage';
import { QuestionRubricGeneratePage } from '@/pages/questions/QuestionRubricGeneratePage';
import { QuestionViewerPage } from '@/pages/questions/QuestionViewerPage';
import { RubricsViewerPage } from '@/pages/questions/RubricsViewerPage';

// HR Panel & Marking
import { ExamBatchesPage } from '@/pages/hr/ExamBatchesPage';
import { RegistrationPage } from '@/pages/hr/RegistrationPage';
import { UnregistrationPage } from '@/pages/hr/UnregistrationPage';
import { TimeEditorPage } from '@/pages/hr/TimeEditorPage';
import { FlowPathPage } from '@/pages/marking/FlowPathPage';
import { AssignExaminerPage } from '@/pages/marking/AssignExaminerPage';
import { NarrativeScorePage } from '@/pages/marking/NarrativeScorePage';

// Viewer & Results
import { SearchExamineePage } from '@/pages/viewer/SearchExamineePage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { ExaminerDashboardPage } from '@/pages/dashboard/ExaminerDashboardPage';

// Candidate Assessment Portal
import { CandidateExamPortalPage } from '@/pages/exam/CandidateExamPortalPage';
import { ScrollToTop } from '@/components/ui/ScrollToTop';

// Renders the Examiner Dashboard for non-Admin/SuperAdmin users assigned as
// Examiner of an active exam batch; the standard Dashboard for everyone else.
const DashboardRoute: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin === true;
  const isAdmin = user?.isAdmin === true || isSuperAdmin;
  const isExaminerOnlyUser = !isAdmin && user?.isExaminerOfActiveBatch === true;

  return isExaminerOnlyUser ? <ExaminerDashboardPage /> : <DashboardPage />;
};

export const App: React.FC = () => {
  return (
    <SystemConfigProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardRoute />} />
                <Route path="/profile" element={<ProfilePage />} />

                {/* Viewer Module */}
                <Route path="/viewer/search-examinee" element={<SearchExamineePage />} />
                <Route path="/question-bank/viewer" element={<QuestionViewerPage />} />
                <Route path="/viewer/rubrics" element={<RubricsViewerPage />} />

                {/* Question Bank Module */}
                <Route path="/question-bank/sets" element={<QuestionSetsPage />} />
                <Route path="/question-bank/mcq" element={<QuestionMCQPage />} />
                <Route path="/question-bank/narrative" element={<QuestionNarrativePage />} />
                <Route path="/question-bank/generate-rubrics" element={<QuestionRubricGeneratePage />} />

                {/* Marking Module */}
                <Route path="/marking/flow-path" element={<FlowPathPage />} />
                <Route path="/marking/flow-path/assign" element={<AssignExaminerPage />} />
                <Route path="/marking/assign-examiner" element={<AssignExaminerPage />} />
                <Route path="/marking/narrative-score" element={<NarrativeScorePage />} />

                {/* HR Panel Module */}
                <Route path="/hr/batches" element={<ExamBatchesPage />} />
                <Route path="/hr/registration" element={<RegistrationPage />} />
                <Route path="/hr/unregistration" element={<UnregistrationPage />} />
                <Route path="/hr/time-editor" element={<TimeEditorPage />} />

                {/* Admin Module */}
                <Route path="/admin/lookup-types" element={<LookupTypePage />} />
                <Route path="/admin/lookups" element={<LookupPage />} />
                <Route path="/admin/users" element={<UserManagementPage />} />
                <Route path="/admin/activity-logs" element={<UserActivityPage />} />
                <Route path="/admin/system-config" element={<SystemConfigPage />} />
              </Route>

              {/* Fullscreen Candidate Exam Mode (without standard sidebar distraction) */}
              <Route path="/exam/take/:registrationId" element={<CandidateExamPortalPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <ScrollToTop />
        </BrowserRouter>
      </AuthProvider>
    </SystemConfigProvider>
  );
};

export default App;
