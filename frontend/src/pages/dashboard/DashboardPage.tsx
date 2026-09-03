import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useSystemConfig } from '@/context/SystemConfigContext';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, FileText, CheckSquare, Award, HelpCircle, ArrowRight, Shield, Layers, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardStats } from '@/types';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { config } = useSystemConfig();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats');
        setStats(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-8 text-white shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="max-w-3xl space-y-2">
          <span className="inline-flex items-center space-x-1.5 rounded-full bg-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-100 uppercase tracking-wider">
            <span className="font-extrabold">{config?.companyName || 'ORION'}</span>
            <span>•</span>
            <span>Promotion Examination System</span>
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.name}!
          </h2>
          <p className="text-blue-100 text-sm">
            {user?.designation ? `${user.designation} — ` : ''}{user?.companyName ? `${user.companyName} (` : ''}{config?.companyName || 'ORION'}{user?.companyName ? ')' : ''} | Employee Assessment Portal
          </p>
        </div>
        <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-xl shadow-blue-950/40 border border-white/20 flex-shrink-0 self-start md:self-center">
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
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Examinees</div>
              <div className="text-2xl font-bold text-slate-900">{stats?.totalExaminees ?? 0}</div>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm p-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Exam Batches</div>
              <div className="text-2xl font-bold text-slate-900">{stats?.totalBatches ?? 0}</div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuickCard
            title="Question Bank & Sets"
            description="Manage question repositories, MCQs, and descriptive written prompts."
            to="/question-bank/sets"
            icon={<Layers className="h-6 w-6 text-blue-600" />}
          />
          <QuickCard
            title="Candidate Registration"
            description="Register eligible employees into exam batches and assign question sets."
            to="/hr/registration"
            icon={<Users className="h-6 w-6 text-emerald-600" />}
          />
          <QuickCard
            title="Examiner Narrative Scoring"
            description="Faculty evaluator interface to review submitted answers and assign marks."
            to="/marking/narrative-score"
            icon={<Award className="h-6 w-6 text-purple-600" />}
          />
          <QuickCard
            title="Exam Batch & Timing"
            description="Configure examination timeframes, durations, and grant live extensions."
            to="/hr/batches"
            icon={<Clock className="h-6 w-6 text-amber-600" />}
          />
          <QuickCard
            title="Results & Transcripts"
            description="View candidate performance leaderboards and generate official printable scorecards."
            to="/viewer/results"
            icon={<FileText className="h-6 w-6 text-rose-600" />}
          />
          <QuickCard
            title="Master Data & Lookups"
            description="Configure system dropdown options: departments, companies, grades, and locations."
            to="/admin/lookups"
            icon={<Shield className="h-6 w-6 text-indigo-600" />}
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
      <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all hover:border-blue-300 group h-full">
        <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-blue-50 transition-colors">
                {icon}
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors transform group-hover:translate-x-1" />
            </div>
            <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              {title}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
