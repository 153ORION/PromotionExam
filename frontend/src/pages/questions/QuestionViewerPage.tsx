import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Filter, CheckCircle2, Circle, FileText, Layers } from 'lucide-react';
import { Question, QuestionSet } from '@/types';

export const QuestionViewerPage: React.FC = () => {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number>(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filterType, setFilterType] = useState<number>(0); // 0 = all, 1 = mcq, 2 = narrative
  const [loading, setLoading] = useState(false);

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
      const fetchQuestions = async () => {
        setLoading(true);
        try {
          const res = await api.get('/questions', {
            params: {
              setId: selectedSetId,
              typeId: filterType > 0 ? filterType : undefined,
            },
          });
          setQuestions(res.data);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchQuestions();
    } else {
      setQuestions([]);
      setLoading(false);
    }
  }, [selectedSetId, filterType]);

  const selectedSet = sets.find((s) => s.setId === selectedSetId);
  const mcqCount = questions.filter((q) => q.typeId === 1).length;
  const narrativeCount = questions.filter((q) => q.typeId === 2).length;
  const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Question Viewer</h2>
          <p className="text-sm text-slate-500">Preview formatted question sets for review, moderation, or printing.</p>
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

          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-slate-700">Question Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm"
            >
              <option value="0">All Questions</option>
              <option value="1">MCQ Questions Only</option>
              <option value="2">Narrative Questions Only</option>
            </select>
          </div>

          <div className="ml-auto flex items-center space-x-3 text-xs font-semibold text-slate-600">
            <span>MCQ: {mcqCount}</span>
            <span>Narrative: {narrativeCount}</span>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-800 font-bold">Total Marks: {totalMarks}</span>
          </div>
        </div>
      </Card>

      {/* Printable Paper Document */}
      {selectedSetId === 0 ? (
        <Card className="p-12 text-center border-slate-200 shadow-sm bg-white no-print">
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-semibold text-slate-800">Please Select a Question Set</h3>
            <p className="text-sm text-slate-500">
              Select a question set from the dropdown above to view, preview, or print the formatted examination paper.
            </p>
          </div>
        </Card>
      ) : (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-8 max-w-4xl mx-auto space-y-6 print:p-0 print:border-none print:shadow-none">
          <div className="text-center border-b pb-6 space-y-2">
            <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">
              Orion Group - Promotion Examination
            </h2>
            <h3 className="text-base font-semibold text-blue-800">{selectedSet?.setName || 'Question Paper'}</h3>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-slate-500 pt-1">
              <span>Location: <strong>{selectedSet?.locationName || 'All'}</strong></span>
              <span>Department: <strong>{selectedSet?.departmentName || 'All'}</strong></span>
              <span>Grade: <strong>{selectedSet?.gradeName || 'All'}</strong></span>
              {selectedSet?.concentrationName && (
                <span>Concentration: <strong>{selectedSet.concentrationName}</strong></span>
              )}
              <span>Total Marks: <strong>{totalMarks}</strong></span>
            </div>
          </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading paper content...</div>
        ) : questions.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No questions found in this set.</div>
        ) : (
          <div className="space-y-6">
            {questions.map((q, idx) => (
              <div key={q.questionId} className="space-y-2.5 pb-4 border-b border-slate-100 last:border-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2">
                    <span className="font-bold text-sm text-slate-800">{idx + 1}.</span>
                    <span className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">{q.question}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-500 font-medium ml-4 whitespace-nowrap">
                    [{q.marks} Marks]
                  </span>
                </div>

                {q.typeId === 1 && (
                  <div className="grid grid-cols-2 gap-2 pl-6 pt-1 text-xs">
                    {q.answers.map((ans, oIdx) => (
                      <div key={ans.answerId || oIdx} className="flex items-center space-x-2">
                        <span className="font-bold text-slate-500">({String.fromCharCode(65 + oIdx)})</span>
                        <span className="text-slate-800">{ans.answerDetails}</span>
                        {ans.isRight && (
                          <span className="text-[10px] text-emerald-600 font-bold ml-1 print:hidden">
                            ✓
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {q.typeId === 2 && q.narrativeAnswer && (
                  <div className="pl-6 text-xs text-slate-500 italic print:hidden">
                    <span className="font-semibold text-amber-700">Model Key: </span>
                    {q.narrativeAnswer}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
};
