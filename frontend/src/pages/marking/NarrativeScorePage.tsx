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
  AiMarkingStatus,
  AiAutoMarkQuestionResult
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

  // Scoring inputs — marks: '' means "not evaluated yet". The My Evaluation form
  // starts blank on candidate load and is filled via Adopt Score / AI Suggest / Adopt All.
  const [scores, setScores] = useState<Record<number, { marks: number | ''; remarks: string }>>({});
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

  // Per-question AI marking status tracking
  const [aiMarkingStatuses, setAiMarkingStatuses] = useState<Record<number, AiMarkingStatus>>({});
  const [aiMarkingErrors, setAiMarkingErrors] = useState<Record<number, string>>({});

  // Per-question AI Suggest feedback (fresh vs cached vs error). A cached evaluate-only
  // response replaces the panel with identical data — without a notice it looks like
  // the button "did nothing".
  const [aiSuggestNotices, setAiSuggestNotices] = useState<Record<number, { type: 'info' | 'success' | 'error'; text: string }>>({});

  // Adopt All dialog state
  const [adoptDialogOpen, setAdoptDialogOpen] = useState<boolean>(false);

  // On mount: load only batches (no auto-select)
  useEffect(() => {
    const initData = async () => {
      try {
        const resBatches = await api.get('/batches');
        const activeBatches = (resBatches.data || []).filter((b: ExamBatch) => b.isActive !== false);
        setBatches(activeBatches);
        // Do NOT auto-select — start with "-- Select Batch --"
      } catch (err) {
        console.error(err);
      }
    };
    initData();
  }, []);

  // When batch changes: load sets and reset
  const handleBatchChange = async (batchId: number) => {
    setSelectedBatchId(batchId);
    setSelectedSetId(0);
    setSets([]);
    setCandidates([]);
    setSelectedCandidate(null);
    setQuestions([]);

    if (batchId <= 0) return;

    try {
      const resSets = await api.get('/questions/sets');
      const activeSets = (resSets.data || []).filter((s: QuestionSet) => s.isActive !== false);
      setSets(activeSets);
    } catch (err) {
      console.error(err);
    }
  };

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
    if (selectedBatchId > 0 && selectedSetId > 0) {
      fetchCandidates();
    } else {
      setCandidates([]);
      setSelectedCandidate(null);
      setQuestions([]);
    }
  }, [selectedBatchId, selectedSetId]);

  const handleSelectCandidate = async (candidate: NarrativeCandidate) => {
    setSelectedCandidate(candidate);
    setLoadingQuestions(true);
    setSaveSuccess(null);
    try {
      const res = await api.get(`/marking/examinee/${candidate.examineeId}/narratives`);
      setQuestions(res.data);

      // My Evaluation starts BLANK for every question — the examiner fills it via
      // "Adopt Score", "AI Suggest" → "Use AI Suggestion", "Adopt All", or typing.
      // Previously saved marks stay visible in the "Previous Examiner Scores"
      // preview panel, so nothing is lost by keeping this form empty.
      const initialScores: Record<number, { marks: number | ''; remarks: string }> = {};
      const initialExpanded: Record<number, boolean> = {};
      res.data.forEach((q: CandidateNarrativeQuestion) => {
        initialScores[q.questionId] = { marks: '', remarks: '' };
        initialExpanded[q.questionId] = true;
      });
      setScores(initialScores);
      setExpandedPreviews(initialExpanded);
      setAiEvaluations(Object.fromEntries(
        res.data.map((q: CandidateNarrativeQuestion) => [q.questionId, q.aiEvaluation || null])
      ));

      // Initialize per-question AI marking status:
      // Completed if an AI evaluation exists OR the AI Examiner already applied a score
      // for this question, otherwise Pending. Failed attempts are not persisted — the
      // user simply re-runs AI marking for that question whenever required.
      const initialStatuses: Record<number, AiMarkingStatus> = {};
      res.data.forEach((q: CandidateNarrativeQuestion) => {
        const hasAiResult = !!q.aiEvaluation || (q.myMarks !== null && q.myMarks !== undefined);
        initialStatuses[q.questionId] = hasAiResult ? 'Completed' : 'Pending';
      });
      setAiMarkingStatuses(initialStatuses);
      setAiMarkingErrors({});
      setAiSuggestNotices({});
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

  // Adopt / Copy marks & remarks from previous examiner into the form ONLY.
  // Nothing is posted here — the examiner records it via the "Save Score" button.
  const handleAdoptScore = (questionId: number, preview: ExaminerScorePreview) => {
    setScores(prev => ({
      ...prev,
      [questionId]: {
        marks: preview.marks,
        remarks: preview.remarks || ''
      }
    }));

    setSaveSuccess(`Adopted ${preview.examinerName}'s score (${preview.marks} marks) for Question #${questionId} into the form. Click "Save Score" to record it.`);
    setTimeout(() => setSaveSuccess(null), 4500);
  };

  // Adopt all scores from a specific examiner for the candidate in one click
  const handleAdoptAllFromExaminer = async (examinerId: number, examinerName: string) => {
    if (!selectedCandidate || questions.length === 0) return;

    const scoresToAdopt: { questionId: number; marks: number; remarks: string }[] = [];
    questions.forEach(q => {
      // Rule: Final Approver Marking → Question Locked — locked questions are not adoptable
      if (q.canEdit === false) return;
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
      alert(`No adoptable scores found from ${examinerName} (questions already marked by the Final Approver are locked).`);
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
      // Populate the My Evaluation form with the adopted scores so the examiner
      // sees (and can adjust) exactly what was recorded per question.
      setScores(prev => {
        const next = { ...prev };
        scoresToAdopt.forEach(s => {
          next[s.questionId] = { marks: s.marks, remarks: s.remarks || '' };
        });
        return next;
      });
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

    // Rule: Final Approver Marking → Question Locked (manual marking attempt blocked)
    if (q.canEdit === false) {
      alert(`Question #${q.questionId} has been marked by the Final Approver${q.finalApproverName ? ` (${q.finalApproverName})` : ''} and is locked. It cannot be marked or rescored anymore.`);
      return;
    }

    const currentScore = scores[q.questionId];
    if (!currentScore || currentScore.marks === undefined || currentScore.marks === null || currentScore.marks === '') {
      alert('Please enter a valid marks value. Use "Adopt Score" or "AI Suggest" to fill the evaluation, or type marks manually.');
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

    // Rule: Final Approver Marking → Question Locked — locked questions cannot be saved/rescored
    const editableQuestions = questions.filter(q => q.canEdit !== false);
    if (editableQuestions.length === 0) {
      alert('All questions have been marked and locked by the Final Approver. No scores can be saved.');
      return;
    }

    // My Evaluation starts blank — only questions where the examiner actually filled
    // marks (via "Adopt Score", "AI Suggest" → "Use AI Suggestion", "Adopt All", or
    // typing) are saved. Blank questions are skipped, never silently saved as 0.
    const filledQuestions = editableQuestions.filter(q => {
      const m = scores[q.questionId]?.marks;
      return m !== undefined && m !== null && m !== '';
    });
    if (filledQuestions.length === 0) {
      alert('No marks entered yet. Use "Adopt Score", "AI Suggest" or "Adopt All" to fill your evaluation, or type marks manually, then save.');
      return;
    }

    for (const q of filledQuestions) {
      const score = scores[q.questionId];
      if (score && score.marks !== '' && score.marks > q.maxMarks) {
        alert(`Question #${q.questionId}: Marks (${score.marks}) cannot exceed maximum allowed (${q.maxMarks}).`);
        return;
      }
      if (score && score.marks !== '' && score.marks < 0) {
        alert(`Question #${q.questionId}: Marks cannot be negative.`);
        return;
      }
    }

    setSavingAll(true);
    setSaveSuccess(null);
    try {
      const scoreItems = filledQuestions.map(q => ({
        questionId: q.questionId,
        marks: Number(scores[q.questionId]?.marks ?? 0),
        remarks: scores[q.questionId]?.remarks ?? ''
      }));

      const res = await api.post('/marking/score-all', {
        examineeId: selectedCandidate.examineeId,
        scores: scoreItems
      });

      const skippedCount = questions.length - editableQuestions.length;
      setSaveSuccess(res.data.message || `All ${scoreItems.length} question scores saved successfully!${skippedCount > 0 ? ` (${skippedCount} locked question(s) skipped — already finalized by the Final Approver.)` : ''}`);
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

  // Evaluate-only flow (AI Suggest / Refresh AI). Always leaves visible feedback:
  // a cached response returns the SAME data already shown, which previously made the
  // button appear to "do nothing" — the per-question notice makes every outcome observable.
  const handleAiEvaluate = async (question: CandidateNarrativeQuestion, forceReevaluate = false) => {
    if (!selectedCandidate) return;

    // Rule: Final Approver Marking → Question Locked (AI marking attempt blocked)
    if (question.canEdit === false) {
      setAiSuggestNotices(prev => ({
        ...prev,
        [question.questionId]: {
          type: 'error',
          text: `Question #${question.questionId} is locked by the Final Approver — AI evaluation is not allowed on finalized questions.`
        }
      }));
      return;
    }

    setAiLoadingQuestionId(question.questionId);
    setAiSuggestNotices(prev => { const n = { ...prev }; delete n[question.questionId]; return n; });
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

      setAiSuggestNotices(prev => ({
        ...prev,
        [question.questionId]: res.data.isCached
          ? {
              type: 'info',
              text: `Existing AI evaluation loaded from cache (${res.data.awardedMarks}/${res.data.maxMarks} marks) — the answer hasn't changed since the last evaluation. Click "Refresh AI" to force a brand-new Gemini evaluation.`
            }
          : {
              type: 'success',
              text: `Fresh Gemini suggestion generated: ${res.data.awardedMarks}/${res.data.maxMarks} marks (confidence ${Math.round((res.data.confidence ?? 0) * 100)}%). Nothing is saved yet — use "Use AI Suggestion" or "Save Score" to record it.`
            }
      }));
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to generate AI evaluation.';
      setAiSuggestNotices(prev => ({
        ...prev,
        [question.questionId]: {
          type: 'error',
          text: `AI Suggest failed: ${msg}`
        }
      }));
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

  // Per-question AI auto-mark: evaluate AND apply score for a single question
  const handleAiAutoMarkQuestion = async (question: CandidateNarrativeQuestion, forceReevaluate = false) => {
    if (!selectedCandidate) return;

    if (question.canEdit === false) {
      alert(`Question #${question.questionId} has been marked by the Final Approver and is locked. AI marking is not allowed.`);
      return;
    }

    setAiMarkingStatuses(prev => ({ ...prev, [question.questionId]: 'Processing' }));
    setAiMarkingErrors(prev => { const n = { ...prev }; delete n[question.questionId]; return n; });

    try {
      const res = await api.post('/marking/ai-auto-mark-question', {
        examineeId: selectedCandidate.examineeId,
        questionId: question.questionId,
        forceReevaluate
      });

      const result: AiAutoMarkQuestionResult = res.data;

      if (result.question.status === 'Error') {
        setAiMarkingStatuses(prev => ({ ...prev, [question.questionId]: 'Failed' }));
        setAiMarkingErrors(prev => ({ ...prev, [question.questionId]: result.question.remarks || result.message }));
        return;
      }

      // Update AI evaluation display
      if (result.question.evaluation) {
        setAiEvaluations(prev => ({
          ...prev,
          [question.questionId]: result.question.evaluation!
        }));
      }

      // Update form scores
      const summaryParts = [
        result.question.evaluation?.summary || '',
        (result.question.evaluation?.missingPoints || []).length ? `Missing: ${result.question.evaluation!.missingPoints.join('; ')}` : '',
        (result.question.evaluation?.incorrectPoints || []).length ? `Incorrect: ${result.question.evaluation!.incorrectPoints.join('; ')}` : ''
      ].filter(Boolean);

      setScores(prev => ({
        ...prev,
        [question.questionId]: {
          marks: result.question.awardedMarks,
          remarks: summaryParts.join(' | ')
        }
      }));

      setAiMarkingStatuses(prev => ({ ...prev, [question.questionId]: 'Completed' }));
      setSaveSuccess(result.message);
      setTimeout(() => setSaveSuccess(null), 4000);

      // Refresh candidates and questions to reflect updated scores.
      // Guarded separately so a refresh failure cannot mislabel a successful marking as Failed.
      try {
        await fetchCandidates();
        const refreshed = await api.get(`/marking/examinee/${selectedCandidate.examineeId}/narratives`);
        setQuestions(refreshed.data);
      } catch (refreshErr) {
        console.error('Failed to refresh candidate data after AI marking:', refreshErr);
      }
    } catch (err: any) {
      setAiMarkingStatuses(prev => ({ ...prev, [question.questionId]: 'Failed' }));
      setAiMarkingErrors(prev => ({ ...prev, [question.questionId]: err.response?.data?.message || err.message || 'AI marking failed.' }));
    }
  };

  // "AI Auto-Mark All" — iterate per-question with live status updates
  const handleRunAutoMark = async () => {
    if (!selectedCandidate) return;

    setAutoMarkingCandidate(true);
    setSaveSuccess(null);
    setAutoMarkDialogOpen(false);

    // Determine which questions to process
    const editableQuestions = questions.filter(q => q.canEdit !== false);
    if (editableQuestions.length === 0) {
      alert('All questions have been marked and locked by the Final Approver. AI marking cannot proceed.');
      setAutoMarkingCandidate(false);
      return;
    }

    // Initialize all editable questions as Pending, locked ones stay as-is
    const statusInit: Record<number, AiMarkingStatus> = { ...aiMarkingStatuses };
    editableQuestions.forEach(q => {
      if (autoMarkForceReevaluate || statusInit[q.questionId] !== 'Completed') {
        statusInit[q.questionId] = 'Pending';
      }
    });
    setAiMarkingStatuses(statusInit);
    setAiMarkingErrors({});

    let evaluatedCount = 0;
    let failedCount = 0;
    let totalAwarded = 0;
    let totalMax = 0;

    // Process each question sequentially with live status
    for (const q of editableQuestions) {
      // Skip already completed if not force-reevaluating
      if (!autoMarkForceReevaluate && aiMarkingStatuses[q.questionId] === 'Completed') {
        continue;
      }

      setAiMarkingStatuses(prev => ({ ...prev, [q.questionId]: 'Processing' }));

      try {
        const res = await api.post('/marking/ai-auto-mark-question', {
          examineeId: selectedCandidate.examineeId,
          questionId: q.questionId,
          forceReevaluate: autoMarkForceReevaluate
        });

        const result: AiAutoMarkQuestionResult = res.data;

        if (result.question.status === 'Error') {
          setAiMarkingStatuses(prev => ({ ...prev, [q.questionId]: 'Failed' }));
          setAiMarkingErrors(prev => ({ ...prev, [q.questionId]: result.question.remarks || result.message }));
          failedCount++;
          continue;
        }

        if (result.question.evaluation) {
          setAiEvaluations(prev => ({
            ...prev,
            [q.questionId]: result.question.evaluation!
          }));
        }

        const summaryParts = [
          result.question.evaluation?.summary || '',
          (result.question.evaluation?.missingPoints || []).length ? `Missing: ${result.question.evaluation!.missingPoints.join('; ')}` : '',
          (result.question.evaluation?.incorrectPoints || []).length ? `Incorrect: ${result.question.evaluation!.incorrectPoints.join('; ')}` : ''
        ].filter(Boolean);

        setScores(prev => ({
          ...prev,
          [q.questionId]: {
            marks: result.question.awardedMarks,
            remarks: summaryParts.join(' | ')
          }
        }));

        setAiMarkingStatuses(prev => ({ ...prev, [q.questionId]: 'Completed' }));
        evaluatedCount++;
        totalAwarded += result.question.awardedMarks;
        totalMax += result.question.maxMarks;
      } catch (err: any) {
        setAiMarkingStatuses(prev => ({ ...prev, [q.questionId]: 'Failed' }));
        setAiMarkingErrors(prev => ({ ...prev, [q.questionId]: err.response?.data?.message || err.message || 'AI marking failed.' }));
        failedCount++;
      }
    }

    // Final refresh — guarded, and autoMarkingCandidate is ALWAYS reset in finally
    // so the AI buttons can never remain stuck disabled after an unexpected error.
    try {
      try {
        await fetchCandidates();
        const refreshed = await api.get(`/marking/examinee/${selectedCandidate.examineeId}/narratives`);
        setQuestions(refreshed.data);
      } catch (refreshErr) {
        console.error('Failed to refresh candidate data after AI auto-mark run:', refreshErr);
      }

      const summary = `AI Examiner completed: ${evaluatedCount} evaluated, ${failedCount} failed out of ${editableQuestions.length} questions. ${totalAwarded.toFixed(2)}/${totalMax.toFixed(2)} marks awarded.${failedCount > 0 ? ' Failed questions can be retried individually.' : ''}`;
      setSaveSuccess(summary);
    } finally {
      setAutoMarkingCandidate(false);
    }
  };

  const activeBatch = batches.find(b => b.batchId === selectedBatchId);
  const myTotalScore = questions.reduce((sum, q) => sum + Number(scores[q.questionId]?.marks ?? 0), 0);
  const maxTotalScore = questions.reduce((sum, q) => sum + Number(q.maxMarks ?? 0), 0);

  // AI Examiner identity (employee 0000000): AI automation buttons are exclusive to this account
  const isAiExaminer = user?.loginId === '0000000';

  // Rule: Examiner/AI Examiner Marking → Final Approver Marking → Question Locked.
  // A question marked by the Final Approver (isFinalized=true) is locked (canEdit=false) for every
  // examiner except the Final Approver. Examiners and the AI Examiner can only mark questions the
  // Final Approver has NOT marked yet.
  const lockedQuestionCount = questions.filter(q => q.isFinalized && !q.canEdit).length;
  const isFullyFinalized = questions.length > 0 && questions.every(q => q.isFinalized === true);
  const isApproverView = questions.length > 0 && questions[0]?.isCurrentExaminerApprover === true;
  const isPartiallyLocked = !isFullyFinalized && lockedQuestionCount > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold text-slate-900">Narrative Answer Grading Portal</h2>
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
              <span className="text-sm font-semibold text-slate-700">Examination Batch:</span>
              <select
                value={selectedBatchId}
                onChange={(e) => handleBatchChange(Number(e.target.value))}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm"
              >
                <option value={0}>-- Select Batch --</option>
                {batches.map((b) => (
                  <option key={b.batchId} value={b.batchId}>
                    {b.examName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-slate-700">Question Set:</span>
              <select
                value={selectedSetId}
                onChange={(e) => setSelectedSetId(Number(e.target.value))}
                disabled={selectedBatchId <= 0}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value={0}>-- Select Set --</option>
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

            {/* AI Auto-Mark via AI Examiner — visible only when the current examiner is the AI Examiner (0000000) */}
            {isAiExaminer && (
              <Button
                type="button"
                onClick={() => setAutoMarkDialogOpen(true)}
                disabled={
                  autoMarkingCandidate ||
                  !selectedCandidate ||
                  questions.length === 0 ||
                  (isFullyFinalized && !isApproverView)
                }
                className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1.5 text-xs h-9 font-semibold shadow-sm"
                title={
                  !selectedCandidate || questions.length === 0
                    ? 'Select a batch, question set, and candidate first to enable AI auto-marking via the AI Examiner'
                    : 'Run Google Gemini AI auto-marking for all questions of this examinee. Applied scores are recorded under the AI Examiner (employee 0000000) account.'
                }
              >
                <Sparkles className={`h-4 w-4 ${autoMarkingCandidate ? 'animate-spin' : 'text-indigo-200'}`} />
                <span>{autoMarkingCandidate ? 'Auto-Marking...' : 'Evaluation All'}</span>
              </Button>
            )}

            {selectedCandidate && questions.length > 0 && (
              <Button
                onClick={handleSaveAllScores}
                disabled={savingAll}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1.5 text-xs h-9"
              >
                <Save className="h-4 w-4" />
                <span>{savingAll ? 'Saving All...' : 'Save All Scores'}</span>
              </Button>
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
            {selectedBatchId <= 0 || selectedSetId <= 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 space-y-2">
                <UserCheck className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p className="font-medium text-slate-600">Select Batch & Question Set</p>
                <p className="text-xs text-slate-400">Choose an exam batch and question set above to load candidates.</p>
              </div>
            ) : loadingCandidates ? (
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
                  <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                    <div>
                      ID: <span className="font-mono">{c.loginId}</span> | {c.designation || 'Staff'}
                    </div>
                    {c.totalQuestionsCount !== undefined && (
                      <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {c.totalQuestionsCount} Qs
                      </span>
                    )}
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
                          {isFullyFinalized ? 'Official Final Mark:' : 'Average Across Examiners:'}
                        </span>
                        <span className="text-base font-bold text-purple-800">
                          {isFullyFinalized
                            ? `${(selectedCandidate.currentNarrativeScore ?? 0).toFixed(2)} / ${maxTotalScore}`
                            : (selectedCandidate.avgNarrativeScore !== null && selectedCandidate.avgNarrativeScore !== undefined
                              ? `${selectedCandidate.avgNarrativeScore.toFixed(2)} / ${maxTotalScore}`
                              : `${(selectedCandidate.currentNarrativeScore ?? 0).toFixed(2)} / ${maxTotalScore}`)}
                        </span>
                      </div>

                      <Button
                        type="button"
                        onClick={() => setAdoptDialogOpen(true)}
                        disabled={savingAll || (isFullyFinalized && !isApproverView)}
                        className="bg-purple-600 hover:bg-purple-700 text-white flex items-center space-x-1.5 text-xs h-10 px-3 font-semibold shadow-sm"
                        title="Adopt all scores from another examiner for this candidate"
                      >
                        <Copy className={`h-4 w-4 ${savingAll ? 'animate-spin' : 'text-purple-200'}`} />
                        <span>{savingAll ? 'Adopting...' : 'Adopt All'}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status Banner for Finalized Marking */}
              {isFullyFinalized && !isApproverView && (
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

              {isFullyFinalized && isApproverView && (
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

              {isPartiallyLocked && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-xl flex items-start space-x-3 mb-6 shadow-sm">
                  <Lock className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-amber-950 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {lockedQuestionCount} of {questions.length} question(s) already marked by the Final Approver ({questions[0]?.finalApproverName || 'Final Approver'})
                      </span>
                      <Badge className="bg-amber-200 text-amber-900 border-amber-400 font-bold">Partially Locked</Badge>
                    </div>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      Those questions are finalized and locked — they cannot be marked, rescored, or AI-evaluated anymore by any examiner or the AI Examiner.
                      You can only mark the remaining questions before the Final Approver completes them.
                    </p>
                  </div>
                </div>
              )}

              {loadingQuestions ? (
                <Card className="p-12 text-center text-slate-400">Loading candidate questions...</Card>
              ) : questions.length === 0 ? (
                <Card className="p-12 text-center text-slate-400">
                  <FileText className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium text-slate-600">No narrative questions found in Examination Question Sheet</p>
                  <p className="text-xs text-slate-400 mt-1">This examinee has no narrative questions assigned in their exam question sheet.</p>
                </Card>
              ) : (
                questions.map((q, qIdx) => {
                  const isPreviewOpen = previewExaminersMode && (expandedPreviews[q.questionId] ?? true);
                  const canEditThisQuestion = q.canEdit ?? true;

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
                          {q.isFinalized && !q.canEdit && (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-xs flex items-center gap-1 font-bold">
                              <Lock className="h-3 w-3" /> Locked by Final Approver
                            </Badge>
                          )}
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
                          {isAiExaminer && (
                            <Badge
                              className={`text-xs flex items-center gap-1 font-semibold ${
                                aiMarkingStatuses[q.questionId] === 'Completed'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : aiMarkingStatuses[q.questionId] === 'Processing'
                                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                                    : aiMarkingStatuses[q.questionId] === 'Failed'
                                      ? 'bg-red-100 text-red-800 border-red-300'
                                      : 'bg-slate-100 text-slate-600 border-slate-300'
                              }`}
                              title={aiMarkingErrors[q.questionId] || undefined}
                            >
                              {aiMarkingStatuses[q.questionId] === 'Completed' && <><CheckCircle className="h-3 w-3" /> AI Marked</>}
                              {aiMarkingStatuses[q.questionId] === 'Processing' && <><Sparkles className="h-3 w-3 animate-spin" /> Processing...</>}
                              {aiMarkingStatuses[q.questionId] === 'Failed' && <><AlertTriangle className="h-3 w-3" /> Failed</>}
                              {(!aiMarkingStatuses[q.questionId] || aiMarkingStatuses[q.questionId] === 'Pending') && <>Pending</>}
                            </Badge>
                          )}
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
                            {canEditThisQuestion && (
                              <div className="flex gap-2 flex-wrap">
                                {/* Per-question AI Auto-Mark button (evaluate + apply score) — exclusive to the AI Examiner account */}
                                {isAiExaminer && (
                                  aiMarkingStatuses[q.questionId] === 'Processing' ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled
                                    className="bg-blue-600 text-white text-[11px] h-8"
                                  >
                                    <Sparkles className="h-3.5 w-3.5 mr-1 animate-spin" />
                                    Processing...
                                  </Button>
                                ) : aiMarkingStatuses[q.questionId] === 'Completed' ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAiAutoMarkQuestion(q, true)}
                                    disabled={autoMarkingCandidate}
                                    className="text-[11px] h-8 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                                    title="Re-evaluate this question with Gemini AI and update the score"
                                  >
                                    <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                                    Regenerate
                                  </Button>
                                ) : aiMarkingStatuses[q.questionId] === 'Failed' ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleAiAutoMarkQuestion(q, true)}
                                    disabled={autoMarkingCandidate}
                                    className="bg-red-600 hover:bg-red-700 text-white text-[11px] h-8"
                                    title={aiMarkingErrors[q.questionId] || 'Retry AI marking for this question'}
                                  >
                                    <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                                    Retry
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleAiAutoMarkQuestion(q, false)}
                                    disabled={autoMarkingCandidate}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] h-8"
                                    title="Evaluate and auto-apply AI score for this question"
                                  >
                                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                                    AI Mark
                                  </Button>
                                  )
                                )}
                                {/* AI Suggest + Refresh AI (evaluate only, no auto-apply) — exclusive to the AI Examiner account */}
                                {isAiExaminer && (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleAiEvaluate(q, false)}
                                      disabled={aiLoadingQuestionId === q.questionId || aiMarkingStatuses[q.questionId] === 'Processing'}
                                      className="text-[11px] h-8 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                                      title="Ask Gemini for a suggested mark WITHOUT saving it — reuses the existing evaluation when the answer hasn't changed"
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
                                        disabled={aiLoadingQuestionId === q.questionId || aiMarkingStatuses[q.questionId] === 'Processing'}
                                        className="text-[11px] h-8 border-slate-300 text-slate-700 hover:bg-slate-100"
                                        title="Request a brand-new Gemini evaluation for this question (bypasses cache) — display only, nothing is saved"
                                      >
                                        <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                                        Refresh AI
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Per-question failure error message */}
                          {aiMarkingStatuses[q.questionId] === 'Failed' && aiMarkingErrors[q.questionId] && (
                            <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-md text-xs flex items-start gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <span>{aiMarkingErrors[q.questionId]}</span>
                            </div>
                          )}

                          {/* AI Suggest / Refresh AI feedback — makes every evaluate-only outcome visible */}
                          {aiSuggestNotices[q.questionId] && (
                            <div className={`p-2.5 border rounded-md text-xs flex items-start gap-2 ${
                              aiSuggestNotices[q.questionId].type === 'error'
                                ? 'bg-red-50 border-red-200 text-red-800'
                                : aiSuggestNotices[q.questionId].type === 'info'
                                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            }`}>
                              {aiSuggestNotices[q.questionId].type === 'error'
                                ? <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                : <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                              <span>{aiSuggestNotices[q.questionId].text}</span>
                            </div>
                          )}

                          {q.aiRubricStatus === 'NotGenerated' && (
                            <p className="text-xs text-slate-600">
                              No AI rubric exists for this question yet — clicking AI Mark will generate it automatically for this question before evaluation.
                            </p>
                          )}

                          {q.aiRubricStatus === 'Outdated' && (
                            <p className="text-xs text-amber-800 flex items-start gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                              The saved rubric no longer matches the latest question or standard answer — running AI Mark will regenerate it automatically for this question before evaluation.
                            </p>
                          )}

                          {q.isFinalized && !canEditThisQuestion && (
                            <p className="text-xs text-purple-800 flex items-start gap-1.5">
                              <Lock className="h-3.5 w-3.5 mt-0.5" />
                              This question has already been marked by the Final Approver. AI marking is locked for finalized questions.
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
                                              className="text-[11px] h-7 px-2 border-purple-300 text-purple-800 hover:bg-purple-100 flex items-center space-x-1"
                                              title="Adopt this examiner's marks & remarks into the form — recorded when you click Save Score"
                                            >
                                              <Copy className="h-3 w-3" />
                                              <span>Adopt Score</span>
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
                            {scores[q.questionId]?.marks !== undefined && scores[q.questionId]?.marks !== '' && (
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
                                value={scores[q.questionId]?.marks ?? ''}
                                placeholder="—"
                                onChange={(e) => handleScoreChange(q.questionId, 'marks', e.target.value === '' ? '' : Number(e.target.value))}
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
            Each question is processed <strong>independently</strong> — you'll see live status updates per question.
            If any question fails, you can retry it individually without reprocessing others.
            Scores are applied under the <strong>AI Examiner</strong> account (employee <strong>0000000</strong>).
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
              <span className="font-semibold text-indigo-700">Google Gemini (Rubric-driven, Question-by-Question)</span>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs flex items-start space-x-2">
              <Sparkles className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
              <span>
                Scores are automatically saved to the scorecard for each question as it is evaluated.
                Each question's status is tracked independently (Pending → Processing → Completed / Failed).
              </span>
            </div>

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

          {isFullyFinalized && !isApproverView && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Marking is finalized by the Final Approver. Scores cannot be saved or changed.</span>
            </div>
          )}

          {isPartiallyLocked && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center space-x-2">
              <Lock className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                {lockedQuestionCount} of {questions.length} question(s) are already marked by the Final Approver and will be skipped — they are locked for AI marking.
              </span>
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
            disabled={autoMarkingCandidate || questions.length === 0 || (isFullyFinalized && !isApproverView)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1.5"
          >
            <Sparkles className={`h-4 w-4 ${autoMarkingCandidate ? 'animate-spin' : ''}`} />
            <span>{autoMarkingCandidate ? 'Evaluating with Gemini...' : `Start Auto-Marking (${questions.length})`}</span>
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Adopt All Scores Dialog */}
      <Dialog open={adoptDialogOpen} onOpenChange={setAdoptDialogOpen}>
        <DialogHeader>
          <div className="flex items-center space-x-2 text-purple-700">
            <Copy className="h-5 w-5" />
            <DialogTitle>Adopt All Scores from Examiner</DialogTitle>
          </div>
          <DialogDescription>
            Select an examiner whose scores you want to adopt for all questions of{' '}
            <strong>{selectedCandidate?.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          {(() => {
            // Collect distinct other examiners across all questions
            const examinerMap = new Map<number, { id: number; name: string; role: string }>();
            questions.forEach(q => {
              (q.examinerScores || []).filter(s => !s.isCurrentExaminer).forEach(s => {
                if (!examinerMap.has(s.examinerId)) {
                  examinerMap.set(s.examinerId, { id: s.examinerId, name: s.examinerName, role: s.role });
                }
              });
            });
            const distinctExaminers = Array.from(examinerMap.values());

            if (distinctExaminers.length === 0) {
              return (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500 space-y-1">
                  <Users className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                  <p className="font-semibold text-slate-600">No other examiner scores available</p>
                  <p>No other examiner has graded this candidate yet. You are the first evaluator.</p>
                </div>
              );
            }

            return (
              <div className="space-y-2">
                <p className="text-xs text-slate-600 font-medium">Choose an examiner to adopt scores from:</p>
                {distinctExaminers.map(ex => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => {
                      setAdoptDialogOpen(false);
                      handleAdoptAllFromExaminer(ex.id, ex.name);
                    }}
                    disabled={savingAll}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-purple-200 bg-purple-50/50 hover:bg-purple-100 transition-colors text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-purple-900">{ex.name}</div>
                      <div className="text-[11px] text-purple-600">{ex.role}</div>
                    </div>
                    <div className="flex items-center space-x-1 text-purple-700 text-xs font-medium">
                      <Copy className="h-3.5 w-3.5" />
                      <span>Adopt All</span>
                    </div>
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAdoptDialogOpen(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};
