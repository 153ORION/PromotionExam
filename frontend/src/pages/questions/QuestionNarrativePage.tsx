import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Filter, Edit, FileText, Sparkles, RefreshCcw, AlertTriangle } from 'lucide-react';
import { Question, QuestionSet } from '@/types';

export const QuestionNarrativePage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formSetId, setFormSetId] = useState<number>(0);
  const [questionText, setQuestionText] = useState('');
  const [narrativeAnswer, setNarrativeAnswer] = useState('');
  const [marks, setMarks] = useState<number>(10.0);
  const [submitting, setSubmitting] = useState(false);
  const [rubricBusyQuestionId, setRubricBusyQuestionId] = useState<number | null>(null);
  const [draftingAnswer, setDraftingAnswer] = useState(false);

  const fetchSets = async () => {
    try {
      const res = await api.get('/questions/sets');
      const activeSets = (res.data || []).filter((s: QuestionSet) => s.isActive !== false);
      setSets(activeSets);
      if (activeSets.length > 0 && selectedSetId === 0) {
        setSelectedSetId(activeSets[0].setId);
        setFormSetId(activeSets[0].setId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQuestions = async (setId?: number) => {
    setLoading(true);
    try {
      const sid = setId !== undefined ? setId : selectedSetId;
      const res = await api.get('/questions', { params: { setId: sid > 0 ? sid : undefined, typeId: 2 } });
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
    setNarrativeAnswer('');
    setMarks(10.0);
    setDialogOpen(true);
  };

  const handleOpenEdit = (q: Question) => {
    setEditingQuestion(q);
    setFormSetId(q.setId);
    setQuestionText(q.question);
    setNarrativeAnswer(q.narrativeAnswer || '');
    setMarks(q.marks);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || formSetId <= 0) return;

    setSubmitting(true);
    try {
      await api.post('/questions', {
        questionId: editingQuestion?.questionId,
        setId: formSetId,
        typeId: 2, // Narrative
        question: questionText.trim(),
        narrativeAnswer: narrativeAnswer.trim() || null,
        marks: Number(marks)
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
    if (!confirm('Are you sure you want to delete this narrative question?')) return;

    try {
      await api.delete(`/questions/${id}`);
      fetchQuestions();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete question');
    }
  };

  const handleGenerateRubric = async (question: Question, forceRegenerate = false) => {
    setRubricBusyQuestionId(question.questionId);
    try {
      const res = await api.post(`/questions/${question.questionId}/ai-rubric/generate`, null, {
        params: { forceRegenerate }
      });
      alert(`${res.data.message} Rubric version: ${res.data.rubric?.versionNo ?? '-'}`);
      fetchQuestions();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate AI rubric.');
    } finally {
      setRubricBusyQuestionId(null);
    }
  };

  const handleDraftStandardAnswer = async () => {
    if (!editingQuestion?.questionId) {
      alert('Please save the question first before drafting a standard answer with Gemini.');
      return;
    }
    setDraftingAnswer(true);
    try {
      const res = await api.post(`/questions/${editingQuestion.questionId}/standard-answer/generate`);
      setNarrativeAnswer(res.data.standardAnswer);
      alert('Standard model answer drafted successfully using Google Gemini!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate standard answer with Gemini.');
    } finally {
      setDraftingAnswer(false);
    }
  };

  const renderRubricBadge = (question: Question) => {
    if (question.aiRubricStatus === 'Ready') {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">
          AI Rubric v{question.aiRubricVersionNo} Ready
        </Badge>
      );
    }

    if (question.aiRubricStatus === 'Outdated') {
      return (
        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-xs">
          Rubric Outdated
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-xs">
        No AI Rubric
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Narrative Questions Master</h2>
          <p className="text-sm text-slate-500">Create open-ended descriptive questions and reference model answers for examiner evaluation.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Link to="/question-bank/generate-rubrics">
            <Button variant="outline" className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 flex items-center space-x-1">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <span>Batch Generate Rubrics</span>
            </Button>
          </Link>
          <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-1">
            <Plus className="h-4 w-4" />
            <span>Add Narrative Question</span>
          </Button>
        </div>
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

      {/* Questions List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="p-8 text-center text-slate-500">Loading narrative questions...</Card>
        ) : questions.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">
            No narrative questions found in this set. Click "Add Narrative Question" above.
          </Card>
        ) : (
          questions.map((q, idx) => (
            <Card key={q.questionId} className="border-slate-200 shadow-sm">
              <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">Question ID: #{q.questionId}</span>
                  <Badge variant="outline" className="text-xs">Marks: {q.marks}</Badge>
                  {renderRubricBadge(q)}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateRubric(q, q.aiRubricStatus === 'Outdated')}
                    disabled={rubricBusyQuestionId === q.questionId}
                    className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                  >
                    {q.aiRubricStatus === 'Outdated' ? (
                      <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                    )}
                    {rubricBusyQuestionId === q.questionId
                      ? 'Processing...'
                      : q.aiRubricStatus === 'Outdated'
                        ? 'Regenerate Rubric'
                        : 'Generate Rubric'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleOpenEdit(q)}>
                    <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(q.questionId)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <CardContent className="p-6 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Question Statement</h4>
                  <div className="text-base font-semibold text-slate-900 mt-1 whitespace-pre-wrap">{q.question}</div>
                </div>

                {q.narrativeAnswer && (
                  <div className="rounded-lg bg-amber-50/70 border border-amber-200 p-4">
                    <h4 className="text-xs font-bold uppercase text-amber-800 tracking-wider flex items-center">
                      <FileText className="h-3.5 w-3.5 mr-1 text-amber-600" /> Reference Model Answer (Guide for Examiner)
                    </h4>
                    <p className="text-sm text-amber-950 mt-1 whitespace-pre-wrap leading-relaxed">
                      {q.narrativeAnswer}
                    </p>
                  </div>
                )}

                <div className={`rounded-lg border p-4 ${
                  q.aiRubricStatus === 'Ready'
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : q.aiRubricStatus === 'Outdated'
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                      <Sparkles className="h-3.5 w-3.5 mr-1 text-emerald-600" /> AI Marking Rubric
                    </h4>
                    <div className="flex items-center gap-2">
                      {renderRubricBadge(q)}
                      {q.aiRubricCriteriaCount ? (
                        <Badge variant="outline" className="text-xs">Criteria: {q.aiRubricCriteriaCount}</Badge>
                      ) : null}
                    </div>
                  </div>

                  {q.aiRubricSummary && (
                    <p className="text-sm text-slate-700 mt-2 leading-relaxed whitespace-pre-wrap">
                      {q.aiRubricSummary}
                    </p>
                  )}

                  {q.aiRubricStatus === 'Outdated' && (
                    <p className="text-xs text-amber-800 mt-2 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                      The question text, standard answer, or marks changed after the current rubric was generated. Regenerate before using AI marking.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingQuestion ? 'Edit Narrative Question' : 'Create Narrative Question'}</DialogTitle>
          <DialogDescription>
            Provide the descriptive question prompt and optional model answer key.
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
            <label className="text-sm font-medium text-slate-700">Question Statement</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Enter the full question or case study prompt..."
              rows={4}
              className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Model Answer (Guide for Grading)</label>
              {editingQuestion?.questionId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDraftStandardAnswer}
                  disabled={draftingAnswer}
                  className="text-xs h-7 border-emerald-300 text-emerald-800 hover:bg-emerald-50 flex items-center gap-1"
                >
                  <Sparkles className={`h-3 w-3 ${draftingAnswer ? 'animate-spin' : 'text-emerald-600'}`} />
                  <span>{draftingAnswer ? 'Drafting...' : 'Draft with Gemini'}</span>
                </Button>
              ) : (
                <span className="text-[11px] text-slate-400">Save question to enable Gemini draft</span>
              )}
            </div>
            <textarea
              value={narrativeAnswer}
              onChange={(e) => setNarrativeAnswer(e.target.value)}
              placeholder="Outline the expected points, steps, and criteria for examiners..."
              rows={5}
              className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Max Marks</label>
            <Input
              type="number"
              step="1"
              min="1"
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Saving...' : 'Save Narrative Question'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
