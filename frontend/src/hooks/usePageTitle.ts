import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Maps route paths (or prefixes) to human-readable page names.
 * More-specific paths must appear before their prefixes.
 */
const ROUTE_TITLES: Array<{ path: string; title: string }> = [
  // Dashboard
  { path: '/dashboard', title: 'Dashboard' },

  // Profile
  { path: '/profile', title: 'Profile' },

  // Viewer
  { path: '/viewer/search-examinee', title: 'Examinee Viewer' },
  { path: '/viewer/rubrics', title: 'Rubrics Viewer' },

  // Question Bank
  { path: '/question-bank/generate-rubrics', title: 'Generate Rubrics' },
  { path: '/question-bank/narrative', title: 'Narrative Questions' },
  { path: '/question-bank/mcq', title: 'MCQ Questions' },
  { path: '/question-bank/sets', title: 'Question Sets' },
  { path: '/question-bank/viewer', title: 'Question Viewer' },

  // Marking
  { path: '/marking/assign-examiner', title: 'Assign Examiner' },
  { path: '/marking/narrative-score', title: 'Narrative Score' },
  { path: '/marking/flow-path/assign', title: 'Assign Examiner' },
  { path: '/marking/flow-path', title: 'Flow Path' },

  // HR Panel
  { path: '/hr/time-editor', title: 'Time Editor' },
  { path: '/hr/registration', title: 'Registration' },
  { path: '/hr/unregistration', title: 'Unregistration' },
  { path: '/hr/batches', title: 'Exam Batches' },

  // Admin
  { path: '/admin/system-config', title: 'System Settings' },
  { path: '/admin/activity-logs', title: 'User Activity Audit' },
  { path: '/admin/users', title: 'User Management' },
  { path: '/admin/lookups', title: 'Lookups' },
  { path: '/admin/lookup-types', title: 'Lookup Types' },

  // Exam Portal
  { path: '/exam/take/', title: 'Exam Portal' },

  // Auth
  { path: '/login', title: 'Login' },
];

const APP_NAME = 'ORION';

function resolveTitle(pathname: string): string | null {
  for (const route of ROUTE_TITLES) {
    if (pathname === route.path || pathname.startsWith(route.path)) {
      return route.title;
    }
  }
  return null;
}

/**
 * Automatically updates document.title whenever the route changes.
 * Format: "Page Name | ORION"
 * Optionally pass an explicit title to override the route-based title.
 */
export function usePageTitle(overrideTitle?: string): void {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = overrideTitle ?? resolveTitle(location.pathname);
    document.title = pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME;
  }, [location.pathname, overrideTitle]);
}
