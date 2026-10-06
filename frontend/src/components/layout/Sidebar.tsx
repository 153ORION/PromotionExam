import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSystemConfig } from '@/context/SystemConfigContext';
import {
  LayoutDashboard,
  Eye,
  HelpCircle,
  CheckSquare,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
  FileQuestion,
  Award,
  Layers,
  ListPlus,
  Edit3,
  GitBranch,
  Clock,
  UserX,
  UserPlus,
  ShieldCheck,
  FileText,
  Activity,
  Building2,
  Sparkles,
  ListChecks,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const { config } = useSystemConfig();
  const location = useLocation();

  // All menu sections collapsed by default; expands when user clicks
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    viewer: false,
    qbank: false,
    marking: false,
    hr: false,
    admin: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isSuperAdmin = user?.isSuperAdmin === true;
  const isAdmin = user?.isAdmin === true || isSuperAdmin;

  // Non-Admin/SuperAdmin users assigned as Examiner of any active exam batch
  // get a restricted menu with only the examiner workflow items.
  const isExaminerOnlyUser = !isAdmin && user?.isExaminerOfActiveBatch === true;

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 text-slate-300 flex flex-col justify-between h-full sticky top-16 overflow-y-auto">
      <div className="p-4 space-y-1">
        {isExaminerOnlyUser ? (
          /* Restricted Examiner Menu */
          <div className="space-y-1">
            <div className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <Award className="h-3.5 w-3.5 text-rose-400" />
              <span>Examiner Panel</span>
            </div>
            <SidebarItem to="/viewer/search-examinee" icon={<Search className="h-4 w-4" />} label="Examinee Viewer" />
            <SidebarItem to="/question-bank/viewer" icon={<FileQuestion className="h-4 w-4" />} label="Question Viewer" />
            <SidebarItem to="/viewer/rubrics" icon={<ListChecks className="h-4 w-4" />} label="Rubrics Viewer" />
            <SidebarItem to="/marking/narrative-score" icon={<Award className="h-4 w-4" />} label="Narrative Score" />
          </div>
        ) : (
        <>
        {/* Dashboard Link */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-blue-600 text-white font-semibold shadow-sm"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            )
          }
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Dashboard</span>
        </NavLink>

        {/* Section: Viewer */}
        <div>
          <button
            onClick={() => toggleSection('viewer')}
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer",
              openSections.viewer ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
            )}
          >
            <div className="flex items-center space-x-2">
              <Eye className="h-3.5 w-3.5 text-amber-400" />
              <span>Viewer</span>
            </div>
            {openSections.viewer ? <ChevronDown className="h-3.5 w-3.5 text-slate-300" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
          </button>

          {openSections.viewer && (
            <div className="mt-1 space-y-1 pl-5">
              <SidebarItem to="/viewer/search-examinee" icon={<Search className="h-4 w-4" />} label="Examinee Viewer" />
              <SidebarItem to="/question-bank/viewer" icon={<FileQuestion className="h-4 w-4" />} label="Question Viewer" />
              <SidebarItem to="/viewer/rubrics" icon={<ListChecks className="h-4 w-4" />} label="Rubrics Viewer" />
            </div>
          )}
        </div>

        {/* Section: Question Bank */}
        <div>
          <button
            onClick={() => toggleSection('qbank')}
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer",
              openSections.qbank ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
            )}
          >
            <div className="flex items-center space-x-2">
              <HelpCircle className="h-3.5 w-3.5 text-blue-400" />
              <span>Question Bank</span>
            </div>
            {openSections.qbank ? <ChevronDown className="h-3.5 w-3.5 text-slate-300" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
          </button>

          {openSections.qbank && (
            <div className="mt-1 space-y-1 pl-5">
              <SidebarItem to="/question-bank/sets" icon={<Layers className="h-4 w-4" />} label="Question Sets" />
              <SidebarItem to="/question-bank/mcq" icon={<ListPlus className="h-4 w-4" />} label="MCQ Questions" />
              <SidebarItem to="/question-bank/narrative" icon={<Edit3 className="h-4 w-4" />} label="Narrative Questions" />
              <SidebarItem to="/question-bank/generate-rubrics" icon={<Sparkles className="h-4 w-4 text-emerald-400" />} label="Generate Rubrics" />
              {/* Upload Excel, Fix Questions and Lookup Mapping are opened from buttons on this page */}
              <SidebarItem
                to="/question-bank/uploaded"
                icon={<Database className="h-4 w-4" />}
                label="Questions"
                alsoActiveOn={['/question-bank/upload', '/question-bank/fix', '/question-bank/mapping']}
              />
            </div>
          )}
        </div>

        {/* Section: Marking */}
        <div>
          <button
            onClick={() => toggleSection('marking')}
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer",
              openSections.marking ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
            )}
          >
            <div className="flex items-center space-x-2">
              <CheckSquare className="h-3.5 w-3.5 text-rose-400" />
              <span>Marking</span>
            </div>
            {openSections.marking ? <ChevronDown className="h-3.5 w-3.5 text-slate-300" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
          </button>

          {openSections.marking && (
            <div className="mt-1 space-y-1 pl-5">
              <SidebarItem to="/marking/flow-path" icon={<GitBranch className="h-4 w-4" />} label="Flow Path" />
              <SidebarItem to="/marking/narrative-score" icon={<Award className="h-4 w-4" />} label="Narrative Score" />
            </div>
          )}
        </div>

        {/* Section: HR Panel (Admin / SuperAdmin) */}
        {isAdmin && (
          <div>
            <button
              onClick={() => toggleSection('hr')}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer",
                openSections.hr ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
              )}
            >
              <div className="flex items-center space-x-2">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                <span>HR Panel</span>
              </div>
              {openSections.hr ? <ChevronDown className="h-3.5 w-3.5 text-slate-300" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
            </button>

            {openSections.hr && (
              <div className="mt-1 space-y-1 pl-5">
                <SidebarItem to="/hr/batches" icon={<FileText className="h-4 w-4" />} label="Exam Batches" />
                <SidebarItem to="/hr/registration" icon={<UserPlus className="h-4 w-4" />} label="Registration" />
                <SidebarItem to="/hr/unregistration" icon={<UserX className="h-4 w-4" />} label="Unregistration" />
                <SidebarItem to="/hr/time-editor" icon={<Clock className="h-4 w-4" />} label="Time Editor" />
              </div>
            )}
          </div>
        )}

        {/* Section: System Administration (SuperAdmin) */}
        {isSuperAdmin && (
          <div>
            <button
              onClick={() => toggleSection('admin')}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer",
                openSections.admin ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
              )}
            >
              <div className="flex items-center space-x-2">
                <Settings className="h-3.5 w-3.5 text-indigo-400" />
                <span>Administration</span>
              </div>
              {openSections.admin ? <ChevronDown className="h-3.5 w-3.5 text-slate-300" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
            </button>

            {openSections.admin && (
              <div className="mt-1 space-y-1 pl-5">
                <SidebarItem to="/admin/lookup-types" icon={<Settings className="h-4 w-4" />} label="Lookup Types" />
                <SidebarItem to="/admin/lookups" icon={<Layers className="h-4 w-4" />} label="Lookups" />
                <SidebarItem to="/admin/users" icon={<ShieldCheck className="h-4 w-4" />} label="User Management" />
                <SidebarItem to="/admin/activity-logs" icon={<Activity className="h-4 w-4 text-blue-400" />} label="User Activity Audit" />
                <SidebarItem to="/admin/system-config" icon={<Building2 className="h-4 w-4 text-emerald-400" />} label="System Settings" />
              </div>
            )}
          </div>
        )}
        </>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
        <div className="font-bold text-slate-200">Developed by ORION IT</div>
        <div>Powered by AI Examiner, Gemini</div>
      </div>
    </aside>
  );
};

// alsoActiveOn: other paths (pages without their own menu entry) that highlight this item.
const SidebarItem: React.FC<{ to: string; icon: React.ReactNode; label: string; alsoActiveOn?: string[] }> = ({ to, icon, label, alsoActiveOn }) => {
  const { pathname } = useLocation();
  const activeElsewhere = alsoActiveOn?.some((p) => pathname.startsWith(p)) ?? false;
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center space-x-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
          isActive || activeElsewhere
            ? "bg-blue-600 text-white font-medium shadow-sm"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        )
      }
    >
      {icon}
      <span className="truncate">{label}</span>
    </NavLink>
  );
};
