import React, { useEffect, useMemo, useState } from 'react';
import api from '@/services/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BookOpenText, CheckCircle, Loader2, Search } from 'lucide-react';
import { Question, QuestionSet } from '@/types';
import { errorMessage } from '@/lib/bulkQuestionUtils';
import { cn } from '@/lib/utils';

const selectClass = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm';

// Question Sets > Questions: every question of the set (its Question_Bank rows), MCQs first in the order
// they were added, with the options and right answer of MCQs and the reference answer of descriptive ones.
export const SetQuestionsDialog: React.FC<{
  set: QuestionSet;
  onClose: () => void;
}> = ({ set, onClose }) => {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [search, setSearch] = useState('');
  const [typeId, setTypeId] = useState(0); // 0 = all, 1 = MCQ, 2 = descriptive
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<Question[]>('/questions', { params: { setId: set.setId } })
      .then((res) => {
        if (!cancelled) setQuestions([...res.data].sort((a, b) => a.typeId - b.typeId || a.questionId - b.questionId));
      })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, 'Failed to load the questions of this set')); });
    return () => { cancelled = true; };
  }, [set.setId]);

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (questions ?? []).filter((q) =>
      (!typeId || q.typeId === typeId) &&
      (!s || q.question.toLowerCase().includes(s)));
  }, [questions, search, typeId]);

  const mcqCount = questions?.filter((q) => q.typeId === 1).length ?? 0;
  const descriptiveCount = (questions?.length ?? 0) - mcqCount;
  const totalMarks = (questions ?? []).reduce((sum, q) => sum + Number(q.marks), 0);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} className="max-w-5xl">
      <DialogHeader>
        <DialogTitle>Questions: {set.setName}</DialogTitle>
        <DialogDescription>
          {questions
            ? `${questions.length} question(s) in this set: ${mcqCount} MCQ, ${descriptiveCount} descriptive · ${totalMarks} total marks.`
            : 'All questions of this set.'}
        </DialogDescription>
      </DialogHeader>

      {!questions && !error && (
        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 text-blue-500 animate-spin" /></div>
      )}

      {questions && (questions.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">This set has no questions yet. Use Sync to add questions from the question bank.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question text" className="pl-9" />
            </div>
            <select className={selectClass} value={typeId} onChange={(e) => setTypeId(Number(e.target.value))} aria-label="Question type">
              <option value={0}>All types</option>
              <option value={1}>MCQ</option>
              <option value={2}>Descriptive</option>
            </select>
          </div>

          <div className="rounded-md border border-slate-200 max-h-[60vh] overflow-auto divide-y divide-slate-100">
            {shown.map((q, idx) => (
              <div key={q.questionId} className="flex items-start gap-3 p-3">
                <span className="w-7 shrink-0 text-sm font-bold text-slate-500">{idx + 1}.</span>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm text-slate-900 whitespace-pre-wrap">{q.question}</p>
                  {q.typeId === 1 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                      {q.answers.map((a, i) => (
                        <div
                          key={a.answerId ?? i}
                          className={cn('flex items-start gap-1.5 rounded px-2 py-1',
                            a.isRight ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-slate-700')}
                        >
                          <span className="font-bold">({String.fromCharCode(65 + i)})</span>
                          <span className="flex-1 whitespace-pre-wrap">{a.answerDetails}</span>
                          {a.isRight && <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" />}
                        </div>
                      ))}
                    </div>
                  ) : q.narrativeAnswer ? (
                    <div className="rounded-md border border-amber-100 bg-amber-50/60 p-2 text-xs text-slate-700">
                      <div className="mb-1 flex items-center gap-1.5 font-bold text-amber-700">
                        <BookOpenText className="h-3.5 w-3.5" /> Reference answer
                      </div>
                      <p className="whitespace-pre-wrap">{q.narrativeAnswer}</p>
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 space-y-1 text-right">
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    q.typeId === 1 ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700')}>
                    {q.typeId === 1 ? 'MCQ' : 'Descriptive'}
                  </span>
                  <div className="text-xs font-mono text-slate-500">{q.marks} marks</div>
                  {q.isActive === false && <div className="text-[11px] font-semibold text-rose-600">Inactive</div>}
                </div>
              </div>
            ))}
            {shown.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No questions match these filters.</p>
            )}
          </div>

          {shown.length < questions.length && (
            <p className="text-xs text-slate-500">{shown.length} of {questions.length} shown.</p>
          )}
        </div>
      ))}

      {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}

      <div className="mt-6 flex justify-end">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </Dialog>
  );
};

export default SetQuestionsDialog;
