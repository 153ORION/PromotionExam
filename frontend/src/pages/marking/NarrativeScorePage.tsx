import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  CheckCircle2,
  ShieldCheck,
  Lock,
  FileText,
  UserCheck,
  Eye,
  EyeOff,
  Save,
  Users,
  ChevronDown,
  ChevronUp,
  Copy,
  Sparkles,
  Award,
  AlertTriangle,
  RefreshCcw
} from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AiNarrativeEvaluation,
  NarrativeCandidate,
  CandidateNarrativeQuestion,
  ExaminerScorePreview,
  ExamBatch,
  QuestionSet,
  AutoMarkExamineeResult
} from '@/types';

export const NarrativeScorePage: React.FC = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [selectedSetId, setSelectedSetId] = useState<number>(0);

  const [candidates, setCandidates] = useState<NarrativeCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<NarrativeCandidate | null>(null);
  const [questions, setQuestions] = useState<CandidateNarrativeQuestion[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Global option: Preview previous examiner markings
  const [previewExaminersMode, setPreviewExaminersMode] = useState<boolean>(true);
  // Per-question toggle map for individual preview sections
  const [expandedPreviews, setExpandedPreviews] = useState<Record<number, boolean>>({});

  // Scoring inputs
  const [scores, setScores] = useState<Record<number, { marks: number; remarks: string }>>({});
  const [aiEvaluations, setAiEvaluations] = useState<Record<number, AiNarrativeEvaluation | null>>({});
  const [aiLoadingQuestionId, setAiLoadingQuestionId] = useState<number | null>(null);
  const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Auto-Mark Examinee States
  const [autoMarkingCandidate, setAutoMarkingCandidate] = useState<boolean>(false);
  const [autoMarkDialogOpen, setAutoMarkDialogOpen] = useState<boolean>(false);
  const [autoMarkApplyScores, setAutoMarkApplyScores] = useState<boolean>(true);
  const [autoMarkForceReevaluate, setAutoMarkForceReevaluate] = useState<boolean>(false);

  useEffect(() => {
    const initData = async () => {
      try {
        const [resBatches, resSets] = await Promise.all([
          api.get('/batches'),
          api.get('/questions/sets'),
        ]);
        const activeBatches = (resBatches.data || []).filter((b: ExamBatch) => b.isActive !== false);
        setBatches(activeBatches);
        if (activeBatches.length > 0) setSelectedBatchId(activeBatches[0].batchId);

        const activeSets = (resSets.data || []).filter((s: QuestionSet) => s.isActive !== false);
        setSets(activeSets);
        if (activeSets.length > 0) setSelectedSetId(activeSets[0].setId);
      } catch (err) {
        console.error(err);
      }
    };
    initData();
  }, []);

  const fetchCandidates = async () => {
    if (selectedBatchId <= 0 || selectedSetId <= 0) return;
    setLoadingCandidates(true);
    try {
      const res = await api.get('/marking/candidates', {
        params: { batchId: selectedBatchId, setId: selectedSetId }
      });
      setCandidates(res.data);
      if (res.data.length > 0) {
        // Keep currently selected candidate if still in list, else select first
        const currentStillExists = selectedCandidate
          ? res.data.find((c: NarrativeCandidate) => c.examineeId === selectedCandidate.examineeId)
          : null;
        if (currentStillExists) {
          setSelectedCandidate(currentStillExists);
        } else {
          handleSelectCandidate(res.data[0]);
        }
      } else {
        setSelectedCandidate(null);
        setQuestions([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [selectedBatchId, selectedSetId]);

  const handleSelectCandidate = async (candidate: NarrativeCandidate) => {
    setSelectedCandidate(candidate);
    setLoadingQuestions(true);
    setSaveSuccess(null);
    try {
      const res = await api.get(`/marking/examinee/${candidate.examineeId}/narratives`);
      setQuestions(res.data);

      // Populate score form state: prioritize myMarks, then fallback to 0
      const initialScores: Record<number, { marks: number; remarks: string }> = {};
      const initialExpanded: Record<number, boolean> = {};
      res.data.forEach((q: CandidateNarrativeQuestion) => {
        initialScores[q.questionId] = {
          marks: q.myMarks !== null && q.myMarks !== undefined ? q.myMarks : (q.awardedMarks ?? 0),
          remarks: q.myRemarks !== null && q.myRemarks !== undefined ? q.myRemarks : (q.remarks || '')
        };
        initialExpanded[q.questionId] = true;
      });
      setScores(initialScores);
      setExpandedPreviews(initialExpanded);
      setAiEvaluations(Object.fromEntries(
        res.data.map((q: CandidateNarrativeQuestion) => [q.questionId, q.aiEvaluation || null])
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleScoreChange = (questionId: number, field: 'marks' | 'remarks', value: any) => {
    setScores(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value
      }
    }));
  };

  const toggleQuestionPreview = (questionId: number) => {
    setExpandedPreviews(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  // Adopt / Copy marks & remarks from previous examiner AND IMMEDIATELY SAVE
  const handleAdoptScore = async (questionId: number, preview: ExaminerScorePreview) => {
    if (!selectedCandidate) return;

    setScores(prev => ({
      ...prev,
      [questionId]: {
        marks: preview.marks,
        remarks: preview.remarks || ''
      }
    }));

    setSavingQuestionId(questionId);
    setSaveSuccess(null);
    try {
      const res = await api.post('/marking/score', {
        examineeId: selectedCandidate.examineeId,
        questionId: questionId,
        marks: Number(preview.marks),
        remarks: preview.remarks || ''
      });
      setSaveSuccess(`Adopted ${preview.examinerName}'s score (${preview.marks} marks) for Question #${questionId} and saved successfully!`);
      setTimeout(() => setSaveSuccess(null), 3500);
      await fetchCandidates();
      const refreshed = await api.get(`/marking/examinee/${selectedCandidate.examineeId}/narratives`);
      setQuestions(refreshed.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to adopt score.');
    } finally {
      setSavingQuestionId(null);
    }
  };

  // Adopt all scores from a specific examiner for the candidate in one click
  const handleAdoptAllFromExaminer = async (examinerId: number, examinerName: string) => {
    if (!selectedCandidate || questions.length === 0) return;

    const scoresToAdopt: { questionId: number; marks: number; remarks: string }[] = [];
    questions.forEach(q => {
      const exScore = q.examinerScores?.find(s => s.examinerId === examinerId);
      if (exScore) {
        scoresToAdopt.push({
          questionId: q.questionId,
          marks: exScore.marks,
          remarks: exScore.remarks || ''
        });
      }
    });

    if (scoresToAdopt.length === 0) {
      alert(`No evaluation scores found from ${examinerName} to adopt.`);
      return;
    }

    if (!window.confirm(`Adopt all ${scoresToAdopt.length} evaluations from ${examinerName} for candidate "${selectedCandidate.name}"? This will record all marks immediately.`)) {
      return;
    }

    setSavingAll(true);
    setSaveSuccess(null);
    try {
      const res = await api.post('/marking/score-all', {
        examineeId: selectedCandidate.examineeId,
        scores: scoresToAdopt
      });

      setSaveSuccess(res.data.message || `All scores adopted from ${examinerName} successfully!`);
      setTimeout(() => setSaveSuccess(null), 4000);
      await fetchCandidates();
      const refreshed = await api.get(`/marking/examinee/${selectedCandidate.examineeId}/narratives`);
      setQuestions(refreshed.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to adopt all scores.');
    } finally {
      setSavingAll(false);
    }
  };

  const handleSaveScore = async (q: CandidateNarrativeQuestion) => {
    if (!selectedCandidate) return;

    const currentScore = scores[q.questionId];
    if (!currentScore || currentScore.marks === undefined || currentScore.marks === null) {
      alert('Please enter a valid marks value.');
      return;
    }

    if (currentScore.marks > q.maxMarks) {
      alert(`Awarded marks cannot exceed maximum allowed marks (${q.maxMarks}).`);
      return;
    }
    if (currentScore.marks < 0) {
      alert('Marks cannot be negative.');
      return;
    }

    setSavingQuestionId(q.questionId);
    setSaveSuccess(null);
    try {
      const res = await api.post('/marking/score', {
        examineeId: selectedCandidate.examineeId,
        questionId: q.questionId,
        marks: Number(currentScore.marks),
        remarks: currentScore.remarks
      });
      setSaveSuccess(`Marks for Question #${q.questionId} saved successfully! (Total Written: ${res.data.totalWrittenScore})`);
      setTimeout(() => setSaveSuccess(null), 3500);
      await fetchCandidates();
      // Reload questions to refresh examiner preview list and averages
      const refreshed = await api.get(`/marking/examinee/${selectedCandidate.examineeId}/narratives`);
      setQuestions(refreshed.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save score.');
    } finally {
      setSavingQuestionId(null);
    }
  };

  const handleSaveAllScores = async () => {
    if (!selectedCandidate || questions.length === 0) return;

    for (const q of questions) {
      const score = scores[q.questionId];
      if (score && score.marks > q.maxMarks) {
        alert(`Question #${q.questionId}: Marks (${score.marks}) cannot exceed maximum allowed (${q.maxMarks}).`);
        return;
      }
      if (score && score.marks < 0) {
        alert(`Question #${q.questionId}: Marks cannot be negative.`);
        return;
      }
    }

    setSavingAll(true);
    setSaveSuccess(null);
    try {
      const scoreItems = questions.map(q => ({
        questionId: q.questionId,
        marks: Number(scores[q.questionId]?.marks ?? 0),
        remarks: scores[q.questionId]?.remarks ?? ''
      }));

      const res = await api.post('/marking/score-all', {
        examineeId: selectedCandidate.examineeId,
        scores: scoreItems
      });

      setSaveSuccess(res.data.message || `All ${scoreItems.length} question scores saved successfully!`);
      setTimeout(() => setSaveSuccess(null), 4000);
      await fetchCandidates();
      const refreshed = await api.get(`/marking/examinee/${selectedCandidate.examineeId}/narratives`);
      setQuestions(refreshed.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save all scores.');
    } finally {
      setSavingAll(false);
    }
  };

  const handleAiEvaluate = async (question: CandidateNarrativeQuestion, forceReevaluate = false) => {
    if (!selectedCandidate) return;

    setAiLoadingQuestionId(question.questionId);
    try {
      const res = await api.post('/marking/ai-evaluate', {
        examineeId: selectedCandidate.examineeId,
        questionId: question.questionId,
        forceReevaluate
      });

      setAiEvaluations(prev => ({
        ...prev,
        [question.questionId]: res.data
      }));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate AI evaluation.');
    } finally {
      setAiLoadingQuestionId(null);
    }
  };

  const applyAiSuggestion = (questionId: number) => {
    const ai = aiEvaluations[questionId];
    if (!ai) return;

    const summaryParts = [
      ai.summary || '',
      ai.missingPoints.length ? `Missing: ${ai.missingPoints.join('; ')}` : '',
      ai.incorrectPoints.length ? `Incorrect: ${ai.incorrectPoints.join('; ')}` : ''
    ].filter(Boolean);

    setScores(prev => ({
      ...prev,
      [questionId]: {
        marks: ai.awardedMarks,
        remarks: summaryParts.join(' | ')
      }
    }));
  };

  const handleRunAutoMark = async () => {
    if (!selectedCandidate) return;

    setAutoMarkingCandidate(true);
    setSaveSuccess(null);
    try {
      const res = await api.post(`/marking/examinee/${selectedCandidate.examineeId}/auto-mark`, {
        forceReevaluate: autoMarkForceReevaluate,
        autoApplyScores: autoMarkApplyScores
      });

      const result: AutoMarkExamineeResult = res.data;

      if (result.questions && result.questions.length > 0) {
        const newAiEvals = { ...aiEvaluations };
        const newScores = { ...scores };

        result.questions.forEach(item => {
          if (item.evaluation) {
            newAiEvals[item.questionId] = item.evaluation;
            if (autoMarkApplyScores) {
              const summaryParts = [
                item.evaluation.summary || '',
                item.evaluation.missingPoints.length ? `Missing: ${item.evaluation.missingPoints.join('; ')}` : '',
                item.evaluation.incorrectPoints.length ? `Incorrect: ${item.evaluation.incorrectPoints.join('; ')}` : ''
              ].filter(Boolean);

              newScores[item.questionId] = {
                marks: item.evaluation.awardedMarks,
                remarks: summaryParts.join(' | ')
              };
            }
          }
        });

        setAiEvaluations(newAiEvals);
        if (autoMarkApplyScores) {
          setScores(newScores);
        }
      }

      setSaveSuccess(result.message);
      setAutoMarkDialogOpen(false);

      if (autoMarkApplyScores) {
        await fetchCandidates();
        const refreshed = await api.get(`/marking/examinee/${selectedCandidate.examineeId}/narratives`);
        setQuestions(refreshed.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to auto-mark candidate answers with Gemini.');
    } finally {
      setAutoMarkingCandidate(false);
    }
  };

  const activeBatch = batches.find(b => b.batchId === selectedBatchId);
  const myTotalScore = questions.reduce((sum, q) => sum + Number(scores[q.questionId]?.marks ?? 0), 0);
  const maxTotalScore = questions.reduce((sum, q) => sum + Number(q.maxMarks ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold text-slate-900">Narrative Answer Grading Portal</h2>
            {activeBatch?.isMultipleExaminer && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-xs">
                Multiple Examiner Marking
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500">
            Faculty Examiner evaluation workspace for subjective and descriptive answers.
          </p>
        </div>

        {/* Current Examiner Badge */}
        {user && (
          <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg text-xs">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-slate-600">Current Examiner:</span>
            <span className="font-bold text-blue-900">{user.name} ({user.loginId})</span>
          </div>
        )}
      </div>

      {/* Top Filter & Evaluation Options Bar */}
      <Card className="p-4 border-slate-200 shadow-sm bg-slate-50/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-slate-700">Exam Batch:</span>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm"
              >
                {batches.map((b) => (
                  <option key={b.batchId} value={b.batchId}>
                    {b.examName} {b.isMultipleExaminer ? '(Multi-Examiner)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-slate-700">Question Set:</span>
              <select
                value={selectedSetId}
                onChange={(e) => setSelectedSetId(Number(e.target.value))}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm"
              >
                {sets.map((s) => (
                  <option key={s.setId} value={s.setId}>
                    {s.setName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action & Preview Controls */}
          <div className="flex items-center space-x-3">
            {/* Global Toggle for Previous Examiner Marking Preview */}
            <Button
              type="button"
              variant={previewExaminersMode ? "default" : "outline"}
              onClick={() => setPreviewExaminersMode(!previewExaminersMode)}
              className={`flex items-center space-x-1.5 text-xs h-9 ${
                previewExaminersMode
                  ? 'bg-purple-700 hover:bg-purple-800 text-white'
                  : 'text-purple-700 border-purple-300 hover:bg-purple-50'
              }`}
              title="Toggle preview of previous/other examiners' scores & feedback"
            >
              {previewExaminersMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span>{previewExaminersMode ? 'Preview Examiner Marking: ON' : 'Preview Examiner Marking: OFF'}</span>
            </Button>

            {selectedCandidate && questions.length > 0 && (
              <>
                <Button
                  type="button"
                  onClick={() => setAutoMarkDialogOpen(true)}
                  disabled={autoMarkingCandidate || (questions[0]?.isFinalized && !questions[0]?.canEdit)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1.5 text-xs h-9 font-semibold shadow-sm"
                  title="Run Google Gemini AI auto-marking for all questions of this examinee"
                >
                  <Sparkles className={`h-4 w-4 ${autoMarkingCandidate ? 'animate-spin' : 'text-indigo-200'}`} />
                  <span>{autoMarkingCandidate ? 'Auto-Marking...' : 'AI Auto-Mark All'}</span>
                </Button>

                <Button
                  onClick={handleSaveAllScores}
                  disabled={savingAll}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1.5 text-xs h-9"
                >
                  <Save className="h-4 w-4" />
                  <span>{savingAll ? 'Saving All...' : 'Save All Scores'}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-sm font-semibold flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidates Roster */}
        <Card className="lg:col-span-1 border-slate-200 shadow-sm h-[750px] flex flex-col">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Candidate Roster</span>
              <Badge variant="outline">{candidates.length}</Badge>
            </CardTitle>
            <CardDescription>Select a candidate to evaluate their submission.</CardDescription>
          </CardHeader>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingCandidates ? (
              <div className="p-6 text-center text-sm text-slate-500">Loading candidates...</div>
            ) : candidates.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">No examinees registered for this set.</div>
            ) : (
              candidates.map((c) => (
                <div
                  key={c.examineeId}
                  onClick={() => handleSelectCandidate(c)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedCandidate?.examineeId === c.examineeId
                      ? 'bg-blue-50/80 border-l-4 border-blue-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm text-slate-900">{c.name}</div>
                    {c.isFinalized ? (
                      <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px] font-bold flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Final Mark ({c.currentNarrativeScore ?? 0})
                      </Badge>
                    ) : c.isEvaluatedByMe ? (
                      <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                        Graded by Me ({c.myNarrativeScore ?? 0})
                      </Badge>
                    ) : c.isEvaluated ? (
                      <Badge className="bg-amber-100 text-amber-800 text-[10px]">
                        Pending Approval
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    ID: <span className="font-mono">{c.loginId}</span> | {c.designation || 'Staff'}
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1.5 pt-1 border-t border-slate-100">
                    <span className="text-blue-700 font-medium">
                      Written: <b>{c.currentNarrativeScore ?? 0}</b> M
                    </span>
                    {c.examinersCount !== undefined && c.examinersCount > 0 && (
                      <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-purple-100">
                        {c.examinersCount} Examiner{c.examinersCount > 1 ? 's' : ''} (Avg: {c.avgNarrativeScore ?? 0})
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Evaluation Grading Panel */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCandidate ? (
            <div>
              {/* Candidate Info & Score Summary Header */}
              <Card className="border-slate-200 shadow-sm mb-4">
                <CardContent className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{selectedCandidate.name}</h3>
                      <p className="text-xs text-slate-500">
                        ID: <span className="font-mono font-semibold">{selectedCandidate.loginId}</span> | {selectedCandidate.departmentName || 'Department'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="bg-white px-3 py-1.5 rounded-lg border border-blue-200 text-right">
                        <span className="text-[11px] text-blue-600 block font-medium">My Awarded Total:</span>
                        <span className="text-base font-bold text-blue-800">
                          {myTotalScore.toFixed(2)} / {maxTotalScore}
                        </span>
                      </div>

                      <div className="bg-white px-3 py-1.5 rounded-lg border border-purple-200 text-right">
                        <span className="text-[11px] text-purple-600 block font-medium">
                          {questions[0]?.isFinalized ? 'Official Final Mark:' : 'Average Across Examiners:'}
                        </span>
                        <span className="text-base font-bold text-purple-800">
                          {questions[0]?.isFinalized
                            ? `${(selectedCandidate.currentNarrativeScore ?? 0).toFixed(2)} / ${maxTotalScore}`
                            : (selectedCandidate.avgNarrativeScore !== null && selectedCandidate.avgNarrativeScore !== undefined
                              ? `${selectedCandidate.avgNarrativeScore.toFixed(2)} / ${maxTotalScore}`
                              : `${(selectedCandidate.currentNarrativeScore ?? 0).toFixed(2)} / ${maxTotalScore}`)}
                        </span>
                      </div>

                      <Button
                        type="button"
                        onClick={() => setAutoMarkDialogOpen(true)}
                        disabled={autoMarkingCandidate || (questions[0]?.isFinalized && !questions[0]?.canEdit)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1.5 text-xs h-10 px-3 font-semibold shadow-sm"
                        title="Run Google Gemini AI auto-marking for all questions of this examinee"
                      >
                        <Sparkles className={`h-4 w-4 ${autoMarkingCandidate ? 'animate-spin' : 'text-indigo-200'}`} />
                        <span>{autoMarkingCandidate ? 'Auto-Marking...' : 'AI Auto-Mark All'}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status Banner for Finalized Marking */}
              {questions[0]?.isFinalized && !questions[0]?.canEdit && (
                <div className="p-4 bg-purple-50 border-2 border-purple-300 text-purple-900 rounded-xl flex items-start space-x-3 mb-6 shadow-sm">
                  <ShieldCheck className="h-6 w-6 text-purple-700 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-purple-950 flex flex-wrap items-center justify-between gap-2">
                      <span>Marking Finalized by Final Approver ({questions[0]?.finalApproverName || 'Final Approver'})</span>
                      <Badge className="bg-purple-200 text-purple-900 border-purple-400 font-bold">Locked / Official Final Mark</Badge>
                    </div>
                    <p className="text-xs text-purple-700 mt-1 leading-relaxed">
                      The Final Approver has evaluated all questions and established the official final written mark ({selectedCandidate.currentNarrativeScore} marks). Score entry is locked and further changes by examiners are prohibited.
                    </p>
                  </div>
                </div>
              )}

              {questions[0]?.isFinalized && questions[0]?.canEdit && (
                <div className="p-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-900 rounded-xl flex items-start space-x-3 mb-6 shadow-sm">
                  <CheckCircle2 className="h-6 w-6 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-emerald-950 flex flex-wrap items-center justify-between gap-2">
                      <span>Final Mark Confirmed (Final Approver)</span>
                      <Badge className="bg-emerald-200 text-emerald-900 border-emerald-400 font-bold">Official Final Mark: {selectedCandidate.currentNarrativeScore} M</Badge>
                    </div>
                    <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                      Your evaluation represents the official Final Mark for this candidate. All other examiners are locked from modifying marks.
                    </p>
                  </div>
                </div>
              )}

              {loadingQuestions ? (
                <Card className="p-12 text-center text-slate-400">Loading candidate questions...</Card>
              ) : questions.length === 0 ? (
                <Card className="p-12 text-center text-slate-400">No narrative questions in this set.</Card>
              ) : (
                questions.map((q, qIdx) => {
                  const otherScores = (q.examinerScores || []).filter(s => !s.isCurrentExaminer);
                  const isPreviewOpen = previewExaminersMode && (expandedPreviews[q.questionId] ?? true);
                  const canEditThisQuestion = q.canEdit ?? true;

                  // Distinct previous examiners for quick adopt
                  const distinctOtherExaminers = Array.from(
                    new Map(otherScores.map(s => [s.examinerId, { id: s.examinerId, name: s.examinerName, role: s.role }])).values()
                  );

                  return (
                    <Card key={q.questionId} className="border-slate-200 shadow-sm mb-6 overflow-hidden">
                      <div className="bg-slate-100/70 px-6 py-3 border-b flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                            {qIdx + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-700">Question #{q.questionId}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {q.avgMarks !== null && q.avgMarks !== undefined && (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-xs">
                              {q.isFinalized ? `Final Mark: ${q.avgMarks}` : `Avg: ${q.avgMarks} Marks`}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs font-semibold">
                            Max Marks: {q.maxMarks}
                          </Badge>
                          <Badge
                            className={`text-xs ${
                              q.aiRubricStatus === 'Ready'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : q.aiRubricStatus === 'Outdated'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {q.aiRubricStatus === 'Ready'
                              ? `AI Rubric v${q.aiRubricVersionNo}`
                              : q.aiRubricStatus === 'Outdated'
                                ? 'Rubric Outdated'
                                : 'No AI Rubric'}
                          </Badge>
                        </div>
                      </div>

                      <CardContent className="p-6 space-y-4">
                        {/* Question Prompt */}
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Question Prompt</span>
                          <div className="text-sm font-semibold text-slate-900 mt-1 whitespace-pre-wrap">{q.question}</div>
                        </div>

                        {/* Candidate's Answer */}
                        <div className="rounded-lg bg-blue-50/50 border border-blue-200 p-4 space-y-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center">
                            <FileText className="h-3.5 w-3.5 mr-1" /> Candidate Submitted Answer
                          </span>
                          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {q.candidateAnswer || '(Candidate did not provide a written response)'}
                          </p>
                        </div>

                        {/* Model Answer (Guide) */}
                        {q.modelAnswer && (
                          <div className="rounded-lg bg-amber-50/50 border border-amber-200 p-4 space-y-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                              Examiner Model Solution / Scoring Criteria
                            </span>
                            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {q.modelAnswer}
                            </p>
                          </div>
                        )}

                        <div className={`rounded-lg border p-4 space-y-3 ${
                          q.aiRubricStatus === 'Ready'
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : q.aiRubricStatus === 'Outdated'
                              ? 'bg-amber-50/60 border-amber-200'
                              : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-emerald-700" />
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                AI Marking Assistant
                              </span>
                            </div>
                            {q.aiRubricStatus === 'Ready' && (
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAiEvaluate(q, false)}
                                  disabled={aiLoadingQuestionId === q.questionId}
                                  className="text-[11px] h-8 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                                >
                                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                                  {aiLoadingQuestionId === q.questionId ? 'Analyzing...' : 'AI Suggest'}
                                </Button>
                                {aiEvaluations[q.questionId] && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAiEvaluate(q, true)}
                                    disabled={aiLoadingQuestionId === q.questionId}
                                    className="text-[11px] h-8 border-slate-300 text-slate-700 hover:bg-slate-100"
                                  >
                                    <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                                    Refresh AI
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>

                          {q.aiRubricStatus === 'NotGenerated' && (
                            <p className="text-xs text-slate-600">
                              No AI rubric exists for this question yet. Generate the rubric from the Narrative Questions page first.
                            </p>
                          )}

                          {q.aiRubricStatus === 'Outdated' && (
                            <p className="text-xs text-amber-800 flex items-start gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                              The saved rubric no longer matches the latest question or standard answer. Regenerate it before requesting AI marking.
                            </p>
                          )}

                          {aiEvaluations[q.questionId] && (
                            <div className="rounded-lg border border-emerald-200 bg-white p-4 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-xs font-bold text-emerald-900">
                                    Suggested Marks: {aiEvaluations[q.questionId]?.awardedMarks} / {q.maxMarks}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Confidence: {Math.round((aiEvaluations[q.questionId]?.confidence ?? 0) * 100)}% | Status: {aiEvaluations[q.questionId]?.validationStatus}
                                  </div>
                                </div>
                                {canEditThisQuestion && aiEvaluations[q.questionId]?.isValidSuggestion && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => applyAiSuggestion(q.questionId)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-8"
                                  >
                                    Use AI Suggestion
                                  </Button>
                                )}
                              </div>

                              {aiEvaluations[q.questionId]?.summary && (
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                  {aiEvaluations[q.questionId]?.summary}
                                </p>
                              )}

                              {aiEvaluations[q.questionId]?.validationNotes && (
                                <div className={`text-xs rounded-md px-3 py-2 border ${
                                  aiEvaluations[q.questionId]?.validationStatus === 'Validated'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-amber-50 text-amber-900 border-amber-200'
                                }`}>
                                  {aiEvaluations[q.questionId]?.validationNotes}
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                <div>
                                  <div className="font-semibold text-slate-700 mb-1">Strengths</div>
                                  <div className="space-y-1 text-slate-600">
                                    {(aiEvaluations[q.questionId]?.strengths || []).length === 0 ? 'None noted' : aiEvaluations[q.questionId]?.strengths.map((item, index) => (
                                      <div key={index}>• {item}</div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-700 mb-1">Missing Points</div>
                                  <div className="space-y-1 text-slate-600">
                                    {(aiEvaluations[q.questionId]?.missingPoints || []).length === 0 ? 'None noted' : aiEvaluations[q.questionId]?.missingPoints.map((item, index) => (
                                      <div key={index}>• {item}</div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-700 mb-1">Incorrect Points</div>
                                  <div className="space-y-1 text-slate-600">
                                    {(aiEvaluations[q.questionId]?.incorrectPoints || []).length === 0 ? 'None noted' : aiEvaluations[q.questionId]?.incorrectPoints.map((item, index) => (
                                      <div key={index}>• {item}</div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-700">Criterion Breakdown</div>
                                {(aiEvaluations[q.questionId]?.criterionBreakdown || []).map((item) => (
                                  <div key={`${item.rubricDetailId}-${item.criterionTitle}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold text-slate-800">{item.criterionTitle}</span>
                                      <span className="font-bold text-emerald-700">{item.awardedMarks} / {item.maxMarks}</span>
                                    </div>
                                    <div className="text-slate-600 mt-1">{item.reason}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Previous Examiner Marking Preview Panel */}
                        {previewExaminersMode && (
                          <div className="rounded-lg bg-purple-50/60 border border-purple-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Users className="h-4 w-4 text-purple-700" />
                                <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                                  Previous Examiner Marking & Feedback ({q.examinerScores?.length || 0})
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleQuestionPreview(q.questionId)}
                                className="text-xs text-purple-700 hover:text-purple-900 flex items-center space-x-1 font-medium"
                              >
                                <span>{isPreviewOpen ? 'Collapse' : 'Expand'}</span>
                                {isPreviewOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </button>
                            </div>

                            {isPreviewOpen && (
                              <div className="space-y-3 pt-1">
                                {distinctOtherExaminers.length > 0 && canEditThisQuestion && (
                                  <div className="flex flex-wrap gap-2 pb-1 border-b border-purple-200/80">
                                    {distinctOtherExaminers.map(ex => (
                                      <Button
                                        key={ex.id}
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleAdoptAllFromExaminer(ex.id, ex.name)}
                                        disabled={savingAll}
                                        className="text-[11px] h-7 px-2.5 bg-white border-purple-300 text-purple-900 hover:bg-purple-100 flex items-center space-x-1 font-medium"
                                        title={`Adopt all narrative scores from ${ex.name} across this candidate's paper`}
                                      >
                                        <Copy className="h-3 w-3 text-purple-700" />
                                        <span>Adopt All from {ex.name} ({ex.role})</span>
                                      </Button>
                                    ))}
                                  </div>
                                )}

                                {(!q.examinerScores || q.examinerScores.length === 0) ? (
                                  <div className="text-xs text-purple-600 italic py-2">
                                    No other examiner has graded this question yet. You are the first evaluator.
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {q.examinerScores.map((score) => (
                                      <div
                                        key={score.scoreId}
                                        className={`p-3 rounded-md border text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
                                          score.isCurrentExaminer
                                            ? 'bg-blue-50 border-blue-200'
                                            : 'bg-white border-purple-200'
                                        }`}
                                      >
                                        <div className="space-y-0.5">
                                          <div className="flex items-center space-x-2">
                                            <span className="font-bold text-slate-900">{score.examinerName}</span>
                                            <span className="text-slate-500 font-normal">
                                              ({score.designation || 'Faculty'}{score.departmentName ? ` - ${score.departmentName}` : ''})
                                            </span>
                                            {score.isApprover ? (
                                              <Badge className="bg-purple-100 text-purple-800 text-[10px]">Final Approver</Badge>
                                            ) : (
                                              <Badge variant="outline" className="text-[10px]">{score.role}</Badge>
                                            )}
                                            {score.isCurrentExaminer && (
                                              <Badge className="bg-blue-100 text-blue-800 text-[10px] font-semibold">
                                                My Submission
                                              </Badge>
                                            )}
                                          </div>
                                          {score.remarks && (
                                            <div className="text-slate-600 italic text-[11px]">
                                              "{score.remarks}"
                                            </div>
                                          )}
                                          <div className="text-[10px] text-slate-400">
                                            Scored On: {score.formattedDate || 'Recent'}
                                          </div>
                                        </div>

                                        <div className="flex items-center space-x-3 self-end sm:self-center">
                                          <div className="text-right">
                                            <span className="text-[10px] text-slate-500 block">Awarded:</span>
                                            <span className="text-sm font-bold text-emerald-700">
                                              {score.marks} / {q.maxMarks}
                                            </span>
                                          </div>

                                          {!score.isCurrentExaminer && canEditThisQuestion && (
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleAdoptScore(q.questionId, score)}
                                              disabled={savingQuestionId === q.questionId}
                                              className="text-[11px] h-7 px-2 border-purple-300 text-purple-800 hover:bg-purple-100 flex items-center space-x-1"
                                              title="Adopt and instantly record this examiner's marks & remarks"
                                            >
                                              <Copy className="h-3 w-3" />
                                              <span>{savingQuestionId === q.questionId ? 'Adopting...' : 'Adopt Score'}</span>
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Current Examiner Scoring Section ("My Evaluation") */}
                        <div className="pt-4 border-t border-slate-200 bg-amber-50/40 p-4 rounded-lg border">
                          <div className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-3 flex items-center justify-between">
                            <span className="flex items-center">
                              <Award className="h-4 w-4 mr-1 text-amber-700" /> My Evaluation ({user?.name || 'Examiner'})
                            </span>
                            {scores[q.questionId]?.marks !== undefined && (
                              <span className="text-xs font-semibold text-blue-800">
                                Awarded: <b>{scores[q.questionId]?.marks}</b> / {q.maxMarks} Marks
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-700">
                                Awarded Marks (0 - {q.maxMarks})
                              </label>
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                max={q.maxMarks}
                                value={scores[q.questionId]?.marks ?? 0}
                                onChange={(e) => handleScoreChange(q.questionId, 'marks', Number(e.target.value))}
                                disabled={!canEditThisQuestion}
                                className={`font-bold text-base bg-white ${
                                  canEditThisQuestion ? 'text-blue-700' : 'text-slate-500 bg-slate-100'
                                }`}
                              />
                            </div>

                            <div className="md:col-span-2 space-y-1">
                              <label className="text-xs font-semibold text-slate-700">My Remarks / Feedback (Optional)</label>
                              <div className="flex space-x-2">
                                <Input
                                  value={scores[q.questionId]?.remarks ?? ''}
                                  onChange={(e) => handleScoreChange(q.questionId, 'remarks', e.target.value)}
                                  placeholder="e.g. Accurate solution, proper safety guidelines covered"
                                  disabled={!canEditThisQuestion}
                                  className={`bg-white ${!canEditThisQuestion ? 'bg-slate-100 text-slate-500' : ''}`}
                                />
                                {canEditThisQuestion ? (
                                  <Button
                                    onClick={() => handleSaveScore(q)}
                                    disabled={savingQuestionId === q.questionId}
                                    className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap text-white"
                                  >
                                    {savingQuestionId === q.questionId ? 'Saving...' : 'Save Score'}
                                  </Button>
                                ) : (
                                  <div className="flex items-center px-3 py-2 bg-purple-100 border border-purple-300 text-purple-900 rounded-md text-xs font-semibold shrink-0">
                                    <Lock className="h-3.5 w-3.5 mr-1" />
                                    <span>Locked</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
            <Card className="p-16 text-center text-slate-400">
              <UserCheck className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-base font-semibold">No candidate selected</p>
              <p className="text-xs">Choose a candidate from the roster on the left to grade their answers.</p>
            </Card>
          )}
        </div>
      </div>

      {/* Auto-Mark Examinee Dialog */}
      <Dialog open={autoMarkDialogOpen} onOpenChange={setAutoMarkDialogOpen}>
        <DialogHeader>
          <div className="flex items-center space-x-2 text-indigo-700">
            <Sparkles className="h-5 w-5" />
            <DialogTitle>Gemini AI Auto-Mark Examinee</DialogTitle>
          </div>
          <DialogDescription>
            Automatically evaluate all narrative questions for <strong>{selectedCandidate?.name}</strong> using Google Gemini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Candidate:</span>
              <span className="font-semibold text-slate-900">{selectedCandidate?.name} ({selectedCandidate?.loginId})</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Narrative Questions:</span>
              <span className="font-semibold text-slate-900">{questions.length} questions ({maxTotalScore} marks total)</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>AI Engine:</span>
              <span className="font-semibold text-indigo-700">Google Gemini (Rubric-driven)</span>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <label className="flex items-start space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoMarkApplyScores}
                onChange={(e) => setAutoMarkApplyScores(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-1"
              />
              <div>
                <span className="font-medium text-slate-800 text-xs block">Automatically save scores & remarks to scorecard</span>
                <span className="text-[11px] text-slate-500 block">
                  Applies awarded marks and detailed feedback into the database and updates candidate totals immediately.
                </span>
              </div>
            </label>

            <label className="flex items-start space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoMarkForceReevaluate}
                onChange={(e) => setAutoMarkForceReevaluate(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-1"
              />
              <div>
                <span className="font-medium text-slate-800 text-xs block">Force Gemini re-evaluation</span>
                <span className="text-[11px] text-slate-500 block">
                  Bypass previously cached AI evaluations and request fresh evaluations from Gemini.
                </span>
              </div>
            </label>
          </div>

          {questions[0]?.isFinalized && !questions[0]?.canEdit && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Marking is finalized. Scores cannot be saved or changed.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAutoMarkDialogOpen(false)}
            disabled={autoMarkingCandidate}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleRunAutoMark}
            disabled={autoMarkingCandidate || questions.length === 0 || (questions[0]?.isFinalized && !questions[0]?.canEdit)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1.5"
          >
            <Sparkles className={`h-4 w-4 ${autoMarkingCandidate ? 'animate-spin' : ''}`} />
            <span>{autoMarkingCandidate ? 'Evaluating with Gemini...' : `Start Auto-Marking (${questions.length})`}</span>
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};
