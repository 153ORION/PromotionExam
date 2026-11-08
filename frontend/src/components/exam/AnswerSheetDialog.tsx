import React, { useEffect, useMemo, useState } from 'react';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, Clock, FileText, Loader2, MinusCircle, XCircle } from 'lucide-react';
import { ExamRegistration } from '@/types';
import { EXAM_STATUS, ExamStatus, examStatus, formatExamTime } from '@/lib/examStatus';
import { errorMessage } from '@/lib/bulkQuestionUtils';
import { cn } from '@/lib/utils';

// The parts of GET /results/answer-paper/{examineeId} this dialog shows.
interface PaperOption {
  answerId: number;
  answerSerial: number;
  answerDetails: string;
  isCorrectOption: boolean;
}

interface PaperMcq {
  questionId: number;
  questionText: string;
  marks: number;
  options: PaperOption[];
  candidateAnswerId?: number;
  isCorrect: boolean;
}

interface PaperWritten {
  questionId: number;
  questionText: string;
  maxMarks: number;
  candidateAnswerText?: string;
}

interface AnswerPaper {
  mcqQuestions: PaperMcq[];
  narrativeQuestions: PaperWritten[];
}

const STATUS_ICONS: Record<ExamStatus, React.ReactNode> = {
  'completed': <CheckCircle2 className="h-3.5 w-3.5" />,
  'in-progress': <Clock className="h-3.5 w-3.5" />,
  'not-submitted': <AlertTriangle className="h-3.5 w-3.5" />,
  'not-started': <MinusCircle className="h-3.5 w-3.5" />,
};

export const ExamStatusBadge: React.FC<{ status: ExamStatus }> = ({ status }) => (
  <span
    title={EXAM_STATUS[status].hint}
    className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', EXAM_STATUS[status].className)}
  >
    {STATUS_ICONS[status]} {EXAM_STATUS[status].label}
  </span>
);

const hasText = (s?: string) => !!s && s.trim() !== '';

// Marking > Answer Sheet: the questions given to one examinee in the order of the exam, with the option
// they chose for each MCQ and what they wrote for each written question.
export const AnswerSheetDialog: React.FC<{
  registration: ExamRegistration;
  onClose: () => void;
}> = ({ registration: r, onClose }) => {
  const [paper, setPaper] = useState<AnswerPaper | null>(null);
  const [section, setSection] = useState<'all' | 'mcq' | 'written'>('all');
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = examStatus(r);

  useEffect(() => {
    let cancelled = false;
    api.get<AnswerPaper>(`/results/answer-paper/${r.examineeId}`)
      .then((res) => { if (!cancelled) setPaper(res.data); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, 'Failed to load the answer sheet')); });
    return () => { cancelled = true; };
  }, [r.examineeId]);

  const mcqAnswered = paper?.mcqQuestions.filter((q) => q.candidateAnswerId != null).length ?? 0;
  const mcqCorrect = paper?.mcqQuestions.filter((q) => q.isCorrect).length ?? 0;
  const writtenAnswered = paper?.narrativeQuestions.filter((q) => hasText(q.candidateAnswerText)).length ?? 0;

  const mcqShown = useMemo(
    () => (paper?.mcqQuestions ?? []).filter((q) => !unansweredOnly || q.candidateAnswerId == null),
    [paper, unansweredOnly]);
  const writtenShown = useMemo(
    () => (paper?.narrativeQuestions ?? []).filter((q) => !unansweredOnly || !hasText(q.candidateAnswerText)),
    [paper, unansweredOnly]);
  const totalCount = (paper?.mcqQuestions.length ?? 0) + (paper?.narrativeQuestions.length ?? 0);
  const visibleCount = (section !== 'written' ? mcqShown.length : 0) + (section !== 'mcq' ? writtenShown.length : 0);

  const tabClass = (active: boolean) => cn('px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
    active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100');

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} className="max-w-5xl">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
          <FileText className="h-5 w-5 text-blue-600" /> Answer Sheet: {r.examineeName}
          <ExamStatusBadge status={status} />
        </DialogTitle>
        <DialogDescription>
          <span className="font-mono">{r.loginId}</span>
          {r.designation && ` · ${r.designation}`}
          {r.departmentName && ` · ${r.departmentName}`}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs">
        <div>
          <div className="text-slate-500">Exam Batch</div>
          <div className="font-semibold text-slate-900">{r.batchName || '-'}</div>
        </div>
        <div>
          <div className="text-slate-500">Question Set</div>
          <div className="font-semibold text-slate-900">{r.setName || '-'}</div>
        </div>
        <div>
          <div className="text-slate-500">Started</div>
          <div className="font-semibold text-slate-900">{formatExamTime(r.examStart)}</div>
        </div>
        <div>
          <div className="text-slate-500">Deadline</div>
          <div className="font-semibold text-slate-900">{formatExamTime(r.examEnd)}</div>
        </div>
      </div>

      {status !== 'completed' && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>{EXAM_STATUS[status].hint}</span>
        </div>
      )}

      {!paper && !error && (
        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 text-blue-500 animate-spin" /></div>
      )}

      {paper && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="flex flex-wrap items-center gap-1">
              <button className={tabClass(section === 'all')} onClick={() => setSection('all')}>
                All ({totalCount})
              </button>
              <button className={tabClass(section === 'mcq')} onClick={() => setSection('mcq')}>
                MCQ ({paper.mcqQuestions.length})
              </button>
              <button className={tabClass(section === 'written')} onClick={() => setSection('written')}>
                Written ({paper.narrativeQuestions.length})
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={unansweredOnly} onChange={(e) => setUnansweredOnly(e.target.checked)} />
              Unanswered only
            </label>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
            <span>MCQ answered: <strong className="text-slate-900">{mcqAnswered} / {paper.mcqQuestions.length}</strong></span>
            <span>MCQ correct: <strong className="text-emerald-700">{mcqCorrect}</strong></span>
            <span>Written answered: <strong className="text-slate-900">{writtenAnswered} / {paper.narrativeQuestions.length}</strong></span>
          </div>

          <div className="max-h-[55vh] overflow-auto space-y-4 pr-1">
            {section !== 'written' && mcqShown.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Part A: MCQ</h3>
                {mcqShown.map((q) => {
                  const answered = q.candidateAnswerId != null;
                  return (
                    <div key={q.questionId} className="rounded-lg border border-slate-200 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900 whitespace-pre-wrap">
                          <span className="mr-1.5 font-bold text-slate-500">{paper.mcqQuestions.indexOf(q) + 1}.</span>
                          {q.questionText}
                        </p>
                        <span className="shrink-0 text-xs">
                          {!answered ? (
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">Not answered</span>
                          ) : q.isCorrect ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Correct
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">
                              <XCircle className="h-3.5 w-3.5" /> Wrong
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                        {q.options.map((o, i) => {
                          const chosen = q.candidateAnswerId === o.answerId;
                          return (
                            <div
                              key={o.answerId}
                              className={cn('flex items-start gap-1.5 rounded border px-2 py-1.5',
                                chosen && o.isCorrectOption ? 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-900'
                                  : chosen ? 'border-rose-400 bg-rose-50 font-semibold text-rose-900'
                                  : o.isCorrectOption ? 'border-emerald-200 text-emerald-800'
                                  : 'border-slate-200 text-slate-700')}
                            >
                              <span className="font-bold">({String.fromCharCode(65 + i)})</span>
                              <span className="flex-1 whitespace-pre-wrap">{o.answerDetails}</span>
                              {chosen && <span className="shrink-0 text-[10px] font-bold uppercase">Chosen</span>}
                              {!chosen && o.isCorrectOption && <span className="shrink-0 text-[10px] font-bold uppercase">Correct</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {section !== 'mcq' && writtenShown.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Part B: Written</h3>
                {writtenShown.map((q) => (
                  <div key={q.questionId} className="rounded-lg border border-slate-200 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900 whitespace-pre-wrap">
                        <span className="mr-1.5 font-bold text-slate-500">W{paper.narrativeQuestions.indexOf(q) + 1}.</span>
                        {q.questionText}
                      </p>
                      <span className="shrink-0 text-xs font-mono text-slate-500">{q.maxMarks} marks</span>
                    </div>
                    {hasText(q.candidateAnswerText) ? (
                      <p className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
                        {q.candidateAnswerText}
                      </p>
                    ) : (
                      <p className="rounded-md border border-dashed border-slate-200 p-2.5 text-xs text-slate-400">Not answered</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {totalCount === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No questions were given to this examinee.</p>
            ) : visibleCount === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">
                {unansweredOnly ? 'Every question here is answered.' : 'No questions in this part.'}
              </p>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}

      <div className="mt-6 flex justify-end">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </Dialog>
  );
};

export default AnswerSheetDialog;
