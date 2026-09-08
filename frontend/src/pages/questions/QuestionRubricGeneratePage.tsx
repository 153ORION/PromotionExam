import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Sparkles, 
  RefreshCcw, 
  Filter, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  FileText, 
  Eye, 
  ArrowLeft, 
  Check, 
  X, 
  HelpCircle,
  BookOpen,
  Layers,
  StopCircle
} from 'lucide-react';
import { Question, QuestionSet, AiRubric } from '@/types';

type FilterTab = 'all' | 'missing' | 'outdated' | 'ready';

interface ItemBatchState {
  status: 'idle' | 'processing' | 'done' | 'error';
  message?: string;
  versionNo?: number;
}

export const QuestionRubricGeneratePage: React.FC = () => {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number>(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSets, setLoadingSets] = useState(true);

  // Filters
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Batch Generation State
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; percent: number; currentQuestionId?: number }>({
    current: 0,
    total: 0,
    percent: 0,
  });
  const [batchItemStates, setBatchItemStates] = useState<Record<number, ItemBatchState>>({});
  const [batchSummary, setBatchSummary] = useState<{
    completed: boolean;
    generated: number;
    skipped: number;
    failed: number;
  } | null>(null);
  const cancelBatchRef = useRef<boolean>(false);

  // Single Item Busy State
  const [singleBusyId, setSingleBusyId] = useState<number | null>(null);

  // View Rubric Modal State
  const [viewRubricModalOpen, setViewRubricModalOpen] = useState(false);
  const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);
  const [activeRubricDetails, setActiveRubricDetails] = useState<AiRubric | null>(null);
  const [loadingRubricDetails, setLoadingRubricDetails] = useState(false);

  // Fetch Question Sets
  const fetchSets = async () => {
    setLoadingSets(true);
    try {
      const res = await api.get('/questions/sets');
      const activeSets = (res.data || []).filter((s: QuestionSet) => s.isActive !== false);
      setSets(activeSets);
      if (activeSets.length > 0 && selectedSetId === 0) {
        setSelectedSetId(activeSets[0].setId);
      }
    } catch (err) {
      console.error('Failed to load question sets:', err);
    } finally {
      setLoadingSets(false);
    }
  };

  // Fetch Narrative Questions for selected set
  const fetchQuestions = async (setId: number) => {
    if (setId <= 0) return;
    setLoading(true);
    setBatchSummary(null);
    setBatchItemStates({});
    try {
      const res = await api.get('/questions', { params: { setId, typeId: 2 } });
      setQuestions(res.data);
    } catch (err) {
      console.error('Failed to load narrative questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
  }, []);

  useEffect(() => {
    if (selectedSetId > 0) {
      fetchQuestions(selectedSetId);
    }
  }, [selectedSetId]);

  // Derived KPI Counts
  const currentSet = sets.find((s) => s.setId === selectedSetId);
  const totalNarrative = questions.length;
  const missingRubricQuestions = questions.filter(
    (q) => !q.aiRubricStatus || q.aiRubricStatus === 'NotGenerated'
  );
  const outdatedRubricQuestions = questions.filter((q) => q.aiRubricStatus === 'Outdated');
  const readyRubricQuestions = questions.filter((q) => q.aiRubricStatus === 'Ready');
  const missingModelAnswerQuestions = questions.filter(
    (q) => !q.narrativeAnswer || q.narrativeAnswer.trim() === ''
  );

  // Filtered List
  const filteredQuestions = questions.filter((q) => {
    // Tab filter
    if (filterTab === 'missing' && q.aiRubricStatus !== 'NotGenerated' && q.aiRubricStatus) return false;
    if (filterTab === 'outdated' && q.aiRubricStatus !== 'Outdated') return false;
    if (filterTab === 'ready' && q.aiRubricStatus !== 'Ready') return false;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchQuestion = q.question.toLowerCase().includes(query);
      const matchAnswer = q.narrativeAnswer?.toLowerCase().includes(query) ?? false;
      const matchId = q.questionId.toString().includes(query);
      return matchQuestion || matchAnswer || matchId;
    }

    return true;
  });

  // Individual Rubric Generation
  const handleGenerateSingle = async (question: Question, forceRegenerate = false) => {
    if (!question.narrativeAnswer || !question.narrativeAnswer.trim()) {
      alert('Cannot generate rubric: Model Answer is missing for Question #' + question.questionId + '. Please add a model answer first.');
      return;
    }

    setSingleBusyId(question.questionId);
    try {
      const res = await api.post(`/questions/${question.questionId}/ai-rubric/generate`, null, {
        params: { forceRegenerate }
      });
      
      // Update question in state
      setQuestions((prev) =>
        prev.map((item) =>
          item.questionId === question.questionId
            ? {
                ...item,
                aiRubricStatus: 'Ready',
                aiRubricVersionNo: res.data.rubric?.versionNo ?? 1,
                aiRubricCriteriaCount: res.data.rubric?.criteria?.length ?? 0,
                aiRubricSummary: res.data.rubric?.rubricSummary,
                aiRubricNeedsRegeneration: false,
              }
            : item
        )
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate AI rubric.');
    } finally {
      setSingleBusyId(null);
    }
  };

  // View Rubric Modal Open
  const handleOpenViewRubric = async (question: Question) => {
    setViewingQuestion(question);
    setViewRubricModalOpen(true);
    setLoadingRubricDetails(true);
    setActiveRubricDetails(null);

    try {
      const res = await api.get(`/questions/${question.questionId}/ai-rubric`);
      setActiveRubricDetails(res.data);
    } catch (err) {
      console.error('Failed to load rubric details:', err);
    } finally {
      setLoadingRubricDetails(false);
    }
  };

  // Batch Generation Runner
  const runBatchGeneration = async (targets: Question[], forceRegenerate = false) => {
    if (targets.length === 0) return;

    cancelBatchRef.current = false;
    setIsBatchRunning(true);
    setBatchSummary(null);

    // Initialize item states for targets
    const initialItemStates: Record<number, ItemBatchState> = {};
    targets.forEach((q) => {
      initialItemStates[q.questionId] = { status: 'idle' };
    });
    setBatchItemStates(initialItemStates);

    let generatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    setBatchProgress({
      current: 0,
      total: targets.length,
      percent: 0,
    });

    for (let i = 0; i < targets.length; i++) {
      if (cancelBatchRef.current) {
        break;
      }

      const q = targets[i];
      setBatchProgress({
        current: i + 1,
        total: targets.length,
        percent: Math.round(((i) / targets.length) * 100),
        currentQuestionId: q.questionId,
      });

      // Check if standard answer is missing
      if (!q.narrativeAnswer || !q.narrativeAnswer.trim()) {
        skippedCount++;
        setBatchItemStates((prev) => ({
          ...prev,
          [q.questionId]: {
            status: 'error',
            message: 'Skipped: Standard model answer is missing.',
          },
        }));
        continue;
      }

      // Mark processing
      setBatchItemStates((prev) => ({
        ...prev,
        [q.questionId]: { status: 'processing' },
      }));

      try {
        const res = await api.post(`/questions/${q.questionId}/ai-rubric/generate`, null, {
          params: { forceRegenerate: forceRegenerate || q.aiRubricStatus === 'Outdated' },
        });

        generatedCount++;
        const version = res.data.rubric?.versionNo ?? 1;
        const criteriaCount = res.data.rubric?.criteria?.length ?? 0;
        const summary = res.data.rubric?.rubricSummary;

        setBatchItemStates((prev) => ({
          ...prev,
          [q.questionId]: {
            status: 'done',
            versionNo: version,
            message: `Generated v${version} (${criteriaCount} criteria)`,
          },
        }));

        // Update in-memory question record
        setQuestions((prev) =>
          prev.map((item) =>
            item.questionId === q.questionId
              ? {
                  ...item,
                  aiRubricStatus: 'Ready',
                  aiRubricVersionNo: version,
                  aiRubricCriteriaCount: criteriaCount,
                  aiRubricSummary: summary,
                  aiRubricNeedsRegeneration: false,
                }
              : item
          )
        );
      } catch (err: any) {
        failedCount++;
        const errorMsg = err.response?.data?.message || 'Failed to generate rubric.';
        setBatchItemStates((prev) => ({
          ...prev,
          [q.questionId]: {
            status: 'error',
            message: errorMsg,
          },
        }));
      }
    }

    setBatchProgress((prev) => ({
      ...prev,
      percent: 100,
      currentQuestionId: undefined,
    }));

    setIsBatchRunning(false);
    setBatchSummary({
      completed: true,
      generated: generatedCount,
      skipped: skippedCount,
      failed: failedCount,
    });
  };

  const handleStopBatch = () => {
    cancelBatchRef.current = true;
  };

  const renderRubricBadge = (q: Question) => {
    if (q.aiRubricStatus === 'Ready') {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-medium">
          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600 inline" />
          AI Rubric v{q.aiRubricVersionNo} Ready
        </Badge>
      );
    }
    if (q.aiRubricStatus === 'Outdated') {
      return (
        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-xs font-medium">
          <AlertTriangle className="h-3 w-3 mr-1 text-amber-600 inline" />
          Rubric Outdated
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-xs font-medium">
        <HelpCircle className="h-3 w-3 mr-1 text-slate-500 inline" />
        No AI Rubric
      </Badge>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Link
              to="/question-bank/narrative"
              className="text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center text-xs mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Narrative Questions Master
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-emerald-600" />
            Generate Gemini AI Marking Rubrics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Automate question-specific scoring rubric generation from reference model answers using Google Gemini.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link to="/question-bank/narrative">
            <Button variant="outline" size="sm" className="text-xs">
              <FileText className="h-3.5 w-3.5 mr-1 text-slate-600" /> Narrative Questions
            </Button>
          </Link>
          <Link to="/question-bank/sets">
            <Button variant="outline" size="sm" className="text-xs">
              <Layers className="h-3.5 w-3.5 mr-1 text-blue-600" /> Question Sets
            </Button>
          </Link>
        </div>
      </div>

      {/* Set Selector Card */}
      <Card className="border-slate-200 shadow-sm bg-gradient-to-r from-slate-50 to-white">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center space-x-2 text-sm font-semibold text-slate-700 whitespace-nowrap">
                <Filter className="h-4 w-4 text-emerald-600" />
                <span>Select Question Set:</span>
              </div>
              <select
                value={selectedSetId}
                onChange={(e) => setSelectedSetId(Number(e.target.value))}
                disabled={isBatchRunning || loadingSets}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium min-w-[280px]"
              >
                {sets.map((s) => (
                  <option key={s.setId} value={s.setId}>
                    {s.setName} {s.departmentName ? `(${s.departmentName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {currentSet && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {currentSet.departmentName && (
                  <span className="rounded bg-slate-200/80 px-2 py-1 font-medium text-slate-700">
                    Dept: {currentSet.departmentName}
                  </span>
                )}
                {currentSet.gradeName && (
                  <span className="rounded bg-slate-200/80 px-2 py-1 font-medium text-slate-700">
                    Grade: {currentSet.gradeName}
                  </span>
                )}
                {currentSet.locationName && (
                  <span className="rounded bg-slate-200/80 px-2 py-1 font-medium text-slate-700">
                    Loc: {currentSet.locationName}
                  </span>
                )}
                {currentSet.concentrationName && (
                  <span className="rounded bg-slate-200/80 px-2 py-1 font-medium text-slate-700">
                    Track: {currentSet.concentrationName}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Narrative */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Narrative Questions</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalNarrative}</h3>
              <p className="text-xs text-slate-400 mt-0.5">In selected set</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <BookOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Rubrics Ready */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Rubrics Ready</p>
              <h3 className="text-2xl font-bold text-emerald-700 mt-1">{readyRubricQuestions.length}</h3>
              <p className="text-xs text-emerald-600 mt-0.5">Active & up to date</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Missing Rubric */}
        <Card className={`border-slate-200 shadow-sm ${missingRubricQuestions.length > 0 ? 'ring-1 ring-rose-300 bg-rose-50/20' : ''}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Missing Rubrics</p>
              <h3 className="text-2xl font-bold text-rose-700 mt-1">{missingRubricQuestions.length}</h3>
              <p className="text-xs text-rose-600 mt-0.5">Not generated yet</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Outdated Rubric */}
        <Card className={`border-slate-200 shadow-sm ${outdatedRubricQuestions.length > 0 ? 'ring-1 ring-amber-300 bg-amber-50/20' : ''}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Outdated Rubrics</p>
              <h3 className="text-2xl font-bold text-amber-700 mt-1">{outdatedRubricQuestions.length}</h3>
              <p className="text-xs text-amber-600 mt-0.5">Question/Answer edited</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings & Alerts */}
      {missingModelAnswerQuestions.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold">
              {missingModelAnswerQuestions.length} narrative question(s) are missing a Model Answer.
            </span>
            <p className="text-xs text-amber-800">
              The AI Rubric generator requires a reference model answer to extract evaluation criteria and marking points. 
              Questions without model answers will be skipped during rubric generation. You can add model answers in the{' '}
              <Link to="/question-bank/narrative" className="font-semibold underline hover:text-amber-950">
                Narrative Questions Master
              </Link>.
            </p>
          </div>
        </div>
      )}

      {/* Batch Generation Control Banner */}
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Batch Rubric Generator</h3>
            </div>
            <p className="text-xs text-slate-300">
              Generate AI evaluation rubrics for all narrative questions in this set where rubrics have not been generated yet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Action: Generate Missing Rubrics */}
            <Button
              onClick={() => runBatchGeneration(missingRubricQuestions, false)}
              disabled={isBatchRunning || missingRubricQuestions.length === 0 || loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition-all flex items-center space-x-1.5"
            >
              <Sparkles className="h-4 w-4 text-white" />
              <span>
                Generate Missing Rubrics ({missingRubricQuestions.length})
              </span>
            </Button>

            {/* Secondary Action: Regenerate Outdated if any */}
            {outdatedRubricQuestions.length > 0 && (
              <Button
                variant="outline"
                onClick={() => runBatchGeneration(outdatedRubricQuestions, true)}
                disabled={isBatchRunning || loading}
                className="bg-amber-500/20 border-amber-400/40 text-amber-200 hover:bg-amber-500/30 hover:text-white"
              >
                <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                Regenerate Outdated ({outdatedRubricQuestions.length})
              </Button>
            )}

            {/* Optional: Regenerate All (if all already exist) */}
            {missingRubricQuestions.length === 0 && readyRubricQuestions.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm('Are you sure you want to regenerate rubrics for ALL narrative questions in this set? Existing versions will be archived.')) {
                    runBatchGeneration(questions, true);
                  }
                }}
                disabled={isBatchRunning || loading}
                className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white text-xs"
              >
                <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                Regenerate All ({totalNarrative})
              </Button>
            )}

            {/* Stop Button */}
            {isBatchRunning && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStopBatch}
                className="flex items-center space-x-1"
              >
                <StopCircle className="h-4 w-4" />
                <span>Cancel</span>
              </Button>
            )}
          </div>
        </div>

        {/* Live Progress Bar if batch running */}
        {isBatchRunning && (
          <div className="p-4 bg-emerald-50/70 border-b border-emerald-100 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <RefreshCcw className="h-3.5 w-3.5 text-emerald-600 animate-spin" />
                Generating Rubrics: Processing question {batchProgress.current} of {batchProgress.total}...
              </span>
              <span>{batchProgress.percent}%</span>
            </div>
            <div className="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${batchProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Batch Completed Summary */}
        {batchSummary && (
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-sm">
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <span className="font-semibold text-slate-900">Batch Rubric Generation Finished</span>
                <p className="text-xs text-slate-500">
                  {batchSummary.generated} generated, {batchSummary.skipped} skipped, {batchSummary.failed} failed.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setBatchSummary(null)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Filter Tabs & Search Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              variant={filterTab === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterTab('all')}
              className={`text-xs ${filterTab === 'all' ? 'bg-slate-900' : 'bg-white'}`}
            >
              All Questions ({totalNarrative})
            </Button>
            <Button
              size="sm"
              variant={filterTab === 'missing' ? 'default' : 'outline'}
              onClick={() => setFilterTab('missing')}
              className={`text-xs ${
                filterTab === 'missing' ? 'bg-rose-700 text-white' : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
              }`}
            >
              Missing Rubric ({missingRubricQuestions.length})
            </Button>
            <Button
              size="sm"
              variant={filterTab === 'outdated' ? 'default' : 'outline'}
              onClick={() => setFilterTab('outdated')}
              className={`text-xs ${
                filterTab === 'outdated' ? 'bg-amber-700 text-white' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
              }`}
            >
              Outdated ({outdatedRubricQuestions.length})
            </Button>
            <Button
              size="sm"
              variant={filterTab === 'ready' ? 'default' : 'outline'}
              onClick={() => setFilterTab('ready')}
              className={`text-xs ${
                filterTab === 'ready' ? 'bg-emerald-700 text-white' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              Ready ({readyRubricQuestions.length})
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative w-full md:w-64">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9 bg-white"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchQuestions(selectedSetId)}
              disabled={loading || isBatchRunning}
              className="text-xs h-9"
            >
              <RefreshCcw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Questions List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="p-12 text-center text-slate-500">
            <RefreshCcw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <p className="text-sm font-medium">Loading narrative questions and rubric statuses...</p>
          </Card>
        ) : filteredQuestions.length === 0 ? (
          <Card className="p-12 text-center text-slate-500">
            <p className="text-base font-semibold text-slate-700">No questions found</p>
            <p className="text-xs text-slate-500 mt-1">
              {questions.length === 0
                ? 'There are no narrative questions defined in this Question Set yet.'
                : 'No narrative questions match the selected filter criteria.'}
            </p>
            {questions.length === 0 && (
              <Link to="/question-bank/narrative" className="inline-block mt-4">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  Create Narrative Question
                </Button>
              </Link>
            )}
          </Card>
        ) : (
          filteredQuestions.map((q, idx) => {
            const batchState = batchItemStates[q.questionId];
            const isItemBusy = singleBusyId === q.questionId || batchState?.status === 'processing';
            const hasModelAnswer = Boolean(q.narrativeAnswer && q.narrativeAnswer.trim());

            return (
              <Card
                key={q.questionId}
                className={`border-slate-200 shadow-sm transition-all ${
                  batchState?.status === 'processing'
                    ? 'ring-2 ring-emerald-500 bg-emerald-50/20'
                    : batchState?.status === 'done'
                    ? 'ring-1 ring-emerald-400 bg-emerald-50/10'
                    : batchState?.status === 'error'
                    ? 'ring-1 ring-rose-400 bg-rose-50/10'
                    : ''
                }`}
              >
                {/* Card Top Banner */}
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      Question #{q.questionId}
                    </span>
                    <Badge variant="outline" className="text-xs font-medium bg-white">
                      {q.marks} Marks
                    </Badge>
                    {renderRubricBadge(q)}

                    {/* Batch Realtime Status Pill */}
                    {batchState?.status === 'processing' && (
                      <Badge className="bg-emerald-600 text-white animate-pulse text-xs">
                        <RefreshCcw className="h-3 w-3 mr-1 animate-spin" /> Generating Rubric...
                      </Badge>
                    )}
                    {batchState?.status === 'done' && (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">
                        <Check className="h-3 w-3 mr-1 text-emerald-600" /> {batchState.message}
                      </Badge>
                    )}
                    {batchState?.status === 'error' && (
                      <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-xs">
                        <X className="h-3 w-3 mr-1 text-rose-600" /> {batchState.message}
                      </Badge>
                    )}
                  </div>

                  {/* Actions for this question */}
                  <div className="flex items-center space-x-2">
                    {q.aiRubricStatus === 'Ready' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenViewRubric(q)}
                        className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" />
                        View Rubric ({q.aiRubricCriteriaCount ?? 0})
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateSingle(q, q.aiRubricStatus === 'Outdated')}
                      disabled={isItemBusy || isBatchRunning || !hasModelAnswer}
                      className={`text-xs ${
                        q.aiRubricStatus === 'Outdated'
                          ? 'border-amber-300 text-amber-800 hover:bg-amber-50'
                          : q.aiRubricStatus === 'Ready'
                          ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 border-transparent font-medium'
                      }`}
                    >
                      {isItemBusy ? (
                        <>
                          <RefreshCcw className="h-3.5 w-3.5 mr-1 animate-spin" />
                          Generating...
                        </>
                      ) : q.aiRubricStatus === 'Outdated' ? (
                        <>
                          <RefreshCcw className="h-3.5 w-3.5 mr-1 text-amber-700" />
                          Regenerate Rubric
                        </>
                      ) : q.aiRubricStatus === 'Ready' ? (
                        <>
                          <RefreshCcw className="h-3.5 w-3.5 mr-1 text-slate-500" />
                          Regenerate
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 mr-1 text-white" />
                          Generate Rubric
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Card Body */}
                <CardContent className="p-5 space-y-4">
                  {/* Question Text */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Question Statement</h4>
                    <div className="text-sm font-medium text-slate-900 mt-1 whitespace-pre-wrap leading-relaxed">
                      {q.question}
                    </div>
                  </div>

                  {/* Standard Model Answer */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                      <span className="flex items-center">
                        <FileText className="h-3.5 w-3.5 mr-1 text-amber-600" /> Reference Model Answer
                      </span>
                      {!hasModelAnswer && (
                        <span className="text-xs text-rose-600 font-semibold normal-case">
                          Required for AI rubric generation
                        </span>
                      )}
                    </h4>

                    {hasModelAnswer ? (
                      <div className="mt-1 rounded-md bg-amber-50/50 border border-amber-200/80 p-3 text-xs text-amber-950 whitespace-pre-wrap leading-relaxed">
                        {q.narrativeAnswer}
                      </div>
                    ) : (
                      <div className="mt-1 rounded-md bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center justify-between">
                        <span>No model answer recorded for this question.</span>
                        <Link to="/question-bank/narrative" className="font-semibold underline hover:text-rose-950">
                          Edit in Narrative Questions Master
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Rubric Status / Summary Preview */}
                  {q.aiRubricSummary && (
                    <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 space-y-1">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                        AI Rubric Summary (v{q.aiRubricVersionNo})
                      </div>
                      <p className="leading-relaxed text-slate-600 whitespace-pre-wrap">
                        {q.aiRubricSummary}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* View Rubric Details Dialog */}
      <Dialog open={viewRubricModalOpen} onOpenChange={setViewRubricModalOpen} className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>
                AI Scoring Rubric Details — Question #{viewingQuestion?.questionId}
              </DialogTitle>
              <DialogDescription>
                Version {activeRubricDetails?.versionNo ?? viewingQuestion?.aiRubricVersionNo} • Max Marks: {viewingQuestion?.marks}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loadingRubricDetails ? (
          <div className="py-12 text-center text-slate-500">
            <RefreshCcw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <p className="text-sm">Loading rubric criteria breakdown...</p>
          </div>
        ) : !activeRubricDetails ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            Failed to load rubric details.
          </div>
        ) : (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {/* Rubric Metadata & Summary */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-900 uppercase tracking-wider">
                  Overall Rubric Overview
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-semibold bg-white">
                    {activeRubricDetails.criteria.length} Scoring Criteria
                  </Badge>
                  {activeRubricDetails.sourceModel && (
                    <Badge variant="outline" className="text-xs bg-white text-slate-500">
                      Model: {activeRubricDetails.sourceModel}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {activeRubricDetails.rubricSummary || 'No summary text available.'}
              </p>
            </div>

            {/* Criteria List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Evaluation Criteria Breakdown
              </h4>

              {activeRubricDetails.criteria.map((crit, cIdx) => (
                <div
                  key={crit.rubricDetailId || cIdx}
                  className="rounded-lg border border-slate-200 bg-white p-4 space-y-2.5 shadow-sm text-xs"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                        {cIdx + 1}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {crit.criterionTitle}
                      </span>
                    </div>
                    <Badge className="bg-emerald-600 text-white font-bold text-xs">
                      {crit.maxMarks} Marks
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div>
                      <span className="font-semibold text-slate-700">Expected Concept:</span>
                      <p className="text-slate-800 mt-0.5 leading-relaxed">{crit.expectedConcept}</p>
                    </div>

                    {crit.scoringGuidance && (
                      <div>
                        <span className="font-semibold text-slate-700">Scoring Guidance:</span>
                        <p className="text-slate-600 mt-0.5 leading-relaxed">{crit.scoringGuidance}</p>
                      </div>
                    )}

                    {crit.keywords && crit.keywords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <span className="font-semibold text-slate-700 mr-1">Key Concepts:</span>
                        {crit.keywords.map((kw, kwIdx) => (
                          <span
                            key={kwIdx}
                            className="inline-block rounded bg-blue-50 border border-blue-200 text-blue-800 px-1.5 py-0.5 text-[10px] font-medium"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    {crit.commonMistakes && crit.commonMistakes.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <span className="font-semibold text-rose-700 mr-1">Common Errors:</span>
                        {crit.commonMistakes.map((cm, cmIdx) => (
                          <span
                            key={cmIdx}
                            className="inline-block rounded bg-rose-50 border border-rose-200 text-rose-800 px-1.5 py-0.5 text-[10px] font-medium"
                          >
                            {cm}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setViewRubricModalOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};
