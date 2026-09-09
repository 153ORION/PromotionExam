import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useSystemConfig } from '@/context/SystemConfigContext';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { Card, CardContent } from '@/components/ui/card';
import { Search, FileQuestion, ListChecks, Award, ArrowRight, Users, UserCheck, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardStats } from '@/types';

export const ExaminerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { config } = useSystemConfig();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats');
        setStats(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-800 to-blue-900 p-8 text-white shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="max-w-3xl space-y-2">
          <span className="inline-flex items-center space-x-1.5 rounded-full bg-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-100 uppercase tracking-wider">
            <span className="font-extrabold">{config?.companyName || 'ORION'}</span>
            <span>•</span>
            <span>Examiner Panel</span>
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.name}!
          </h2>
          <p className="text-indigo-100 text-sm">
            {user?.designation ? `${user.designation} — ` : ''}You are assigned as an Examiner for an active examination batch.
            Use the modules below to review candidates, questions, rubrics and submit narrative scores.
          </p>
        </div>
        <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-xl shadow-indigo-950/40 border border-white/20 flex-shrink-0 self-start md:self-center">
          <CompanyLogo className="h-full w-full object-contain" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm p-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Examinees</div>
              <div className="text-2xl font-bold text-slate-900">{stats?.totalExaminees ?? 0}</div>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm p-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current Examinees</div>
              <div className="text-2xl font-bold text-slate-900">{stats?.totalCurrentExaminees ?? 0}</div>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm p-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">MCQ Bank</div>
              <div className="text-2xl font-bold text-slate-900">{stats?.totalMCQQuestions ?? 0}</div>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm p-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Written Bank</div>
              <div className="text-2xl font-bold text-slate-900">{stats?.totalWrittenQuestions ?? 0}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Navigation Modules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <QuickCard
            title="Examinee Viewer"
            description="Query and lookup registered candidate test records, scores, and answer papers."
            to="/viewer/search-examinee"
            icon={<Search className="h-6 w-6 text-rose-600" />}
          />
          <QuickCard
            title="Question Viewer"
            description="Preview formatted question sets of the assigned examination for review or printing."
            to="/question-bank/viewer"
            icon={<FileQuestion className="h-6 w-6 text-blue-600" />}
          />
          <QuickCard
            title="Rubrics Viewer"
            description="Review narrative questions with reference model answers, generated rubrics and marks breakdown."
            to="/viewer/rubrics"
            icon={<ListChecks className="h-6 w-6 text-emerald-600" />}
          />
          <QuickCard
            title="Narrative Score"
            description="Evaluate submitted narrative answers and assign marks with AI-assisted rubric guidance."
            to="/marking/narrative-score"
            icon={<Award className="h-6 w-6 text-purple-600" />}
          />
        </div>
      </div>
    </div>
  );
};

const QuickCard: React.FC<{ title: string; description: string; to: string; icon: React.ReactNode }> = ({
  title,
  description,
  to,
  icon,
}) => {
  return (
    <Link to={to}>
      <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all hover:border-indigo-300 group h-full">
        <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-indigo-50 transition-colors">
                {icon}
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors transform group-hover:translate-x-1" />
            </div>
            <h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              {title}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
