import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, BookOpenText, Sparkles, ShieldAlert, CircleSlash } from 'lucide-react';
import { QuestionSet, RubricViewerQuestion } from '@/types';

const RubricStatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  switch (status) {
    case 'Ready':
      return <Badge className="bg-emerald-100 text-emerald-800">Rubric Ready</Badge>;
    case 'Outdated':
      return (
        <Badge className="bg-amber-100 text-amber-800 flex items-center space-x-1">
          <ShieldAlert className="h-3 w-3" />
          <span>Outdated</span>
        </Badge>
      );
    default:
      return (
        <Badge className="bg-slate-100 text-slate-600 flex items-center space-x-1">
          <CircleSlash className="h-3 w-3" />
          <span>Not Generated</span>
        </Badge>
      );
  }
};

export const RubricsViewerPage: React.FC = () => {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number>(0);
  const [questions, setQuestions] = useState<RubricViewerQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSets = async () => {
      try {
        const res = await api.get('/questions/sets');
        const activeSets = (res.data || []).filter((s: QuestionSet) => s.isActive !== false);
        setSets(activeSets);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSets();
  }, []);

  useEffect(() => {
    if (selectedSetId > 0) {
      const fetchRubrics = async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await api.get(`/questions/sets/${selectedSetId}/rubrics`);
          setQuestions(res.data?.questions || []);
        } catch (err: unknown) {
          console.error(err);
          setQuestions([]);
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Failed to load rubrics for this question set. Please verify the API server is running the latest build and try again.';
          setError(message);
        } finally {
          setLoading(false);
        }
      };
      fetchRubrics();
    } else {
      setQuestions([]);
      setError(null);
      setLoading(false);
    }
  }, [selectedSetId]);

  const selectedSet = sets.find((s) => s.setId === selectedSetId);
  const readyCount = questions.filter((q) => q.rubricStatus === 'Ready').length;
  const outdatedCount = questions.filter((q) => q.rubricStatus === 'Outdated').length;
  const missingCount = questions.filter((q) => q.rubricStatus === 'NotGenerated').length;
  const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rubrics Viewer</h2>
          <p className="text-sm text-slate-500">
            Review narrative questions with reference model answers, generated AI rubrics and marks breakdown.
          </p>
        </div>
        <Button onClick={handlePrint} disabled={selectedSetId === 0} className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-1 disabled:opacity-50">
          <Printer className="h-4 w-4" />
          <span>Print / Export PDF</span>
        </Button>
      </div>

      {/* Control Bar */}
      <Card className="p-4 border-slate-200 shadow-sm bg-slate-50/50 no-print">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-slate-700">Question Set:</span>
            <select
              value={selectedSetId}
              onChange={(e) => setSelectedSetId(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm"
            >
              <option value="0">-- Select Set --</option>
              {sets.map((s) => (
                <option key={s.setId} value={s.setId}>
                  {s.setName}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex flex-wrap items-center space-x-3 text-xs font-semibold text-slate-600">
            <span>Narrative Questions: {questions.length}</span>
            <span className="text-emerald-700">Ready: {readyCount}</span>
            {outdatedCount > 0 && <span className="text-amber-700">Outdated: {outdatedCount}</span>}
            {missingCount > 0 && <span className="text-slate-500">Missing: {missingCount}</span>}
            <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-800 font-bold">Total Marks: {totalMarks}</span>
          </div>
        </div>
      </Card>

      {/* Rubric Document */}
      {selectedSetId === 0 ? (
        <Card className="p-12 text-center border-slate-200 shadow-sm bg-white no-print">
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-semibold text-slate-800">Please Select a Question Set</h3>
            <p className="text-sm text-slate-500">
              Select a question set from the dropdown above to view narrative questions along with their reference
              model answers, generated rubrics and marks breakdown.
            </p>
          </div>
        </Card>
      ) : (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-8 space-y-6 print:p-0 print:border-none print:shadow-none">
          <div className="text-center border-b pb-6 space-y-2">
            <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">
              Rubrics Review Sheet
            </h2>
            <h3 className="text-base font-semibold text-blue-800">{selectedSet?.setName || 'Question Set'}</h3>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-slate-500 pt-1">
              <span>Location: <strong>{selectedSet?.locationName || 'All'}</strong></span>
              <span>Department: <strong>{selectedSet?.departmentName || 'All'}</strong></span>
              <span>Grade: <strong>{selectedSet?.gradeName || 'All'}</strong></span>
              {selectedSet?.concentrationName && (
                <span>Concentration: <strong>{selectedSet.concentrationName}</strong></span>
              )}
              <span>Narrative Questions: <strong>{questions.length}</strong></span>
              <span>Total Marks: <strong>{totalMarks}</strong></span>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading rubrics...</div>
          ) : error ? (
            <div className="py-12 text-center space-y-1">
              <div className="text-sm font-semibold text-rose-700">Could not load rubrics</div>
              <p className="text-xs text-slate-500">{error}</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No narrative questions found in this set.
            </div>
          ) : (
            <div className="space-y-8">
              {questions.map((q, idx) => (
                <div key={q.questionId} className="space-y-3 pb-6 border-b border-slate-100 last:border-0">
                  {/* Question + Marks */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2">
                      <span className="font-bold text-sm text-slate-800">{idx + 1}.</span>
                      <span className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">{q.question}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-500 font-medium ml-4 whitespace-nowrap">
                      [{q.marks} Marks]
                    </span>
                  </div>

                  {/* Reference Model Answer */}
                  <div className="pl-6 rounded-md bg-amber-50/60 border border-amber-100 p-3 space-y-1">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-700">
                      <BookOpenText className="h-3.5 w-3.5" />
                      <span>Reference Model Answer</span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">
                      {q.narrativeAnswer || '— No reference model answer defined for this question. —'}
                    </p>
                  </div>

                  {/* Generated Rubric Summary */}
                  {q.rubricSummary && (
                    <div className="pl-6 space-y-1">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-700">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Rubric Summary:  </span>
                          {q.rubricVersionNo != null && (
                            <span className="font-semibold text-slate-600">Version {q.rubricVersionNo}</span>
                          )}
                          {q.rubricSourceModel && <span className="text-xs text-slate-600 italic">Model: {q.rubricSourceModel}</span>}
                          {q.rubricGeneratedAt && (
                            <span className="text-xs text-slate-600 italic">Generated: {new Date(q.rubricGeneratedAt).toLocaleString()}</span>
                          )}

                      </div>
                    </div>
                  )}

                  {/* Marks Breakdown */}
                  <div className="pl-6">
                    {q.rubricStatus === 'NotGenerated' ? (
                      <div className="text-xs text-slate-400 italic py-2">
                        Rubric has not been generated for this question yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-md border border-slate-200">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600">
                              <th className="px-3 py-2 font-semibold w-8">#</th>
                              <th className="px-3 py-2 font-semibold">Criterion</th>
                              <th className="px-3 py-2 font-semibold">Expected Concept</th>
                              <th className="px-3 py-2 font-semibold">Scoring Guidance</th>
                              <th className="px-3 py-2 font-semibold text-right w-20">Marks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...q.criteria]
                              .sort((a, b) => a.sortOrder - b.sortOrder)
                              .map((c, cIdx) => (
                                <tr key={c.rubricDetailId || cIdx} className="border-b border-slate-100 last:border-0 align-top">
                                  <td className="px-3 py-2 text-slate-500 font-mono">{cIdx + 1}</td>
                                  <td className="px-3 py-2 font-semibold text-slate-800">{c.criterionTitle}</td>
                                  <td className="px-3 py-2 text-slate-600">{c.expectedConcept}</td>
                                  <td className="px-3 py-2 text-slate-500">{c.scoringGuidance || '—'}</td>
                                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">
                                    {c.maxMarks}
                                  </td>
                                </tr>
                              ))}
                            <tr className="bg-slate-50 border-t border-slate-200">
                              <td colSpan={4} className="px-3 py-2 text-right font-bold text-slate-700">
                                Total
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-blue-800">
                                {q.criteria.reduce((sum, c) => sum + Number(c.maxMarks), 0)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
