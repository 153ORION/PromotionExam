import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, CheckCircle2, Circle, Filter, Edit, Layers } from 'lucide-react';
import { Question, QuestionSet, QuestionOption } from '@/types';

export const QuestionMCQPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formSetId, setFormSetId] = useState<number>(0);
  const [questionText, setQuestionText] = useState('');
  const [marks, setMarks] = useState<number>(1.0);
  const [options, setOptions] = useState<{ details: string; isRight: boolean }[]>([
    { details: '', isRight: true },
    { details: '', isRight: false },
    { details: '', isRight: false },
    { details: '', isRight: false }
  ]);
  const [submitting, setSubmitting] = useState(false);

  const fetchSets = async () => {
    try {
      const res = await api.get('/questions/sets');
      setSets(res.data);
      if (res.data.length > 0 && selectedSetId === 0) {
        setSelectedSetId(res.data[0].setId);
        setFormSetId(res.data[0].setId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQuestions = async (setId?: number) => {
    setLoading(true);
    try {
      const sid = setId !== undefined ? setId : selectedSetId;
      const res = await api.get('/questions', { params: { setId: sid > 0 ? sid : undefined, typeId: 1 } });
      setQuestions(res.data);
    } catch (err) {
      console.error(err);
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

  const handleOpenAdd = () => {
    setEditingQuestion(null);
    setFormSetId(selectedSetId > 0 ? selectedSetId : (sets[0]?.setId || 0));
    setQuestionText('');
    setMarks(1.0);
    setOptions([
      { details: '', isRight: true },
      { details: '', isRight: false },
      { details: '', isRight: false },
      { details: '', isRight: false }
    ]);
    setDialogOpen(true);
  };

  const handleOpenEdit = (q: Question) => {
    setEditingQuestion(q);
    setFormSetId(q.setId);
    setQuestionText(q.question);
    setMarks(q.marks);
    if (q.answers && q.answers.length > 0) {
      setOptions(q.answers.map(a => ({ details: a.answerDetails, isRight: a.isRight })));
    } else {
      setOptions([
        { details: '', isRight: true },
        { details: '', isRight: false }
      ]);
    }
    setDialogOpen(true);
  };

  const setCorrectOption = (index: number) => {
    setOptions(prev => prev.map((opt, i) => ({
      ...opt,
      isRight: i === index
    })));
  };

  const handleOptionChange = (index: number, val: string) => {
    setOptions(prev => {
      const next = [...prev];
      next[index].details = val;
      return next;
    });
  };

  const addOption = () => {
    setOptions(prev => [...prev, { details: '', isRight: false }]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) {
      alert('A multiple-choice question must have at least 2 options.');
      return;
    }
    setOptions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || formSetId <= 0) return;

    if (!options.some(o => o.isRight)) {
      alert('Please select which option is correct.');
      return;
    }

    if (options.some(o => !o.details.trim())) {
      alert('Please fill in text for all options.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/questions', {
        questionId: editingQuestion?.questionId,
        setId: formSetId,
        typeId: 1, // MCQ
        question: questionText.trim(),
        marks: Number(marks),
        options: options.map((o, idx) => ({
          answerDetails: o.details.trim(),
          answerSerial: idx + 1,
          isRight: o.isRight
        }))
      });
      setDialogOpen(false);
      fetchQuestions();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      await api.delete(`/questions/${id}`);
      fetchQuestions();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete question');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">MCQ Questions Master</h2>
          <p className="text-sm text-slate-500">Add, review, and edit multiple choice questions with automated answer keys.</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-1">
          <Plus className="h-4 w-4" />
          <span>Add MCQ Question</span>
        </Button>
      </div>

      {/* Set Filter */}
      <Card className="p-4 border-slate-200 shadow-sm bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm font-semibold text-slate-700">
            <Filter className="h-4 w-4 text-blue-600" />
            <span>Select Question Set:</span>
          </div>
          <select
            value={selectedSetId}
            onChange={(e) => setSelectedSetId(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600 max-w-md"
          >
            {sets.map((s) => (
              <option key={s.setId} value={s.setId}>
                {s.setName}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Question Cards List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="p-8 text-center text-slate-500">Loading MCQ questions...</Card>
        ) : questions.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">
            No MCQ questions found in this set. Click "Add MCQ Question" above to create one.
          </Card>
        ) : (
          questions.map((q, idx) => (
            <Card key={q.questionId} className="border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">Question ID: #{q.questionId}</span>
                  <Badge variant="outline" className="text-xs">Marks: {q.marks}</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline" onClick={() => handleOpenEdit(q)}>
                    <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(q.questionId)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <CardContent className="p-6 space-y-4">
                <div className="text-base font-semibold text-slate-900">{q.question}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {q.answers.map((ans, oIdx) => (
                    <div
                      key={ans.answerId || oIdx}
                      className={`flex items-start space-x-3 p-3 rounded-lg border text-sm ${
                        ans.isRight
                          ? 'border-emerald-300 bg-emerald-50/60 text-emerald-950 font-medium'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <div className="mt-0.5">
                        {ans.isRight ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-xs text-slate-500 mr-2">
                          ({String.fromCharCode(65 + oIdx)})
                        </span>
                        <span>{ans.answerDetails}</span>
                      </div>
                      {ans.isRight && (
                        <span className="rounded bg-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          CORRECT
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingQuestion ? 'Edit MCQ Question' : 'Create New MCQ Question'}</DialogTitle>
          <DialogDescription>
            Enter the question text, define options, and select the correct option.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Question Set</label>
            <select
              value={formSetId}
              onChange={(e) => setFormSetId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              required
            >
              {sets.map((s) => (
                <option key={s.setId} value={s.setId}>
                  {s.setName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Question Text</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Type the full question statement..."
              rows={3}
              className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Marks</label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
              required
            />
          </div>

          {/* Options List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-800">Options (Select Radio for Correct Answer):</label>
              <Button type="button" size="sm" variant="outline" onClick={addOption}>
                + Add Option
              </Button>
            </div>

            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="correctOption"
                  checked={opt.isRight}
                  onChange={() => setCorrectOption(idx)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  title="Mark as correct answer"
                />
                <span className="text-xs font-semibold text-slate-500 w-6">
                  {String.fromCharCode(65 + idx)}.
                </span>
                <Input
                  value={opt.details}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + idx)} text`}
                  className={opt.isRight ? 'border-emerald-500 ring-1 ring-emerald-400' : ''}
                  required
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Saving...' : 'Save MCQ Question'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
