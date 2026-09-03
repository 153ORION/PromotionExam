import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { useSystemConfig } from '@/context/SystemConfigContext';
import { 
  Printer, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  HelpCircle, 
  User, 
  Building2, 
  Calendar, 
  Clock, 
  Award,
  AlertCircle
} from 'lucide-react';

interface CandidateAnswerPaperModalProps {
  examineeId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OptionDto {
  answerId: number;
  answerSerial: number;
  answerDetails: string;
  isCorrectOption: boolean;
}

interface McqQuestionDto {
  questionId: number;
  typeId: number;
  questionText: string;
  marks: number;
  options: OptionDto[];
  candidateAnswerId?: number;
  candidateAnswerText?: string;
  correctAnswerId?: number;
  correctAnswerText?: string;
  isCorrect: boolean;
  awardedMarks: number;
}

interface NarrativeQuestionDto {
  questionId: number;
  typeId: number;
  questionText: string;
  maxMarks: number;
  modelAnswer?: string;
  candidateAnswerText?: string;
  awardedMarks: number;
  examinerRemarks?: string;
  evaluatedDate?: string;
}

interface AnswerPaperData {
  examineeId: number;
  candidate: {
    hrRecordId: number;
    loginId: string;
    name: string;
    designation?: string;
    departmentName?: string;
    companyName?: string;
    locationName?: string;
    gradeName?: string;
    email?: string;
    mobile?: string;
  };
  exam: {
    batchId: number;
    batchName?: string;
    examYear?: number;
    questionSetId: number;
    setName?: string;
    examStart?: string;
    examEnd?: string;
    isAttended: boolean;
    isCompleted: boolean;
    mcqScore: number;
    writtenScore: number;
    totalScore: number;
    totalPossibleMarks: number;
    isPassed: boolean;
  };
  mcqQuestions: McqQuestionDto[];
  narrativeQuestions: NarrativeQuestionDto[];
}

export const CandidateAnswerPaperModal: React.FC<CandidateAnswerPaperModalProps> = ({
  examineeId,
  open,
  onOpenChange,
}) => {
  const { config } = useSystemConfig();
  const [data, setData] = useState<AnswerPaperData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterSection, setFilterSection] = useState<'all' | 'mcq' | 'narrative'>('all');

  useEffect(() => {
    if (open && examineeId) {
      const fetchAnswerPaper = async () => {
        setLoading(true);
        try {
          const res = await api.get(`/results/answer-paper/${examineeId}`);
          setData(res.data);
        } catch (err) {
          console.error('Failed to load candidate answer paper:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchAnswerPaper();
    } else {
      setData(null);
    }
  }, [open, examineeId]);

  const handlePrint = () => {
    window.print();
  };

  const serialLetter = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-4xl p-6 sm:p-8">
      {loading || !data ? (
        <div className="py-16 text-center text-slate-500">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm">Loading Candidate Answer Paper & Script...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Modal Header & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
            <div className="flex items-center space-x-3">
              <CompanyLogo className="h-10 w-auto max-h-11 max-w-[120px] object-contain flex-shrink-0" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  {config?.companyName || 'ORION'}
                </div>
                <h2 className="text-xl font-bold text-slate-900 leading-tight">
                  Candidate Examination Answer Paper
                </h2>
                <p className="text-xs text-slate-500">
                  Verified candidate answers, question-by-question scoring, and narrative assessment script.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 no-print self-end sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="flex items-center space-x-1.5 text-xs text-slate-700 hover:bg-slate-100"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Answer Paper</span>
              </Button>
            </div>
          </div>

          {/* Candidate Profile & Exam Summary Banner */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Candidate Profile</span>
              <div className="text-sm font-bold text-slate-900">{data.candidate.name}</div>
              <div className="text-slate-600">Employee ID: <span className="font-mono font-semibold">{data.candidate.loginId}</span></div>
              <div className="text-slate-600">{data.candidate.designation || 'Officer'}</div>
              <div className="text-slate-500">{data.candidate.departmentName} • {data.candidate.companyName || 'Orion'}</div>
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Exam Information</span>
              <div className="text-sm font-bold text-slate-900">{data.exam.batchName}</div>
              <div className="text-slate-600">Question Set: <span className="font-medium text-slate-900">{data.exam.setName}</span></div>
              <div className="text-slate-600">Exam Year: <span className="font-medium">{data.exam.examYear || 2026}</span></div>
              {data.exam.examStart && (
                <div className="text-slate-500">
                  Date: {new Date(data.exam.examStart).toLocaleDateString()} {new Date(data.exam.examStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>

            <div className="space-y-2 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-200 md:pl-4 pt-2 md:pt-0">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Evaluation Summary</span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white p-2 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-medium">MCQ Score</div>
                  <div className="text-sm font-bold text-emerald-700">{data.exam.mcqScore}</div>
                </div>
                <div className="rounded-lg bg-white p-2 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-medium">Written</div>
                  <div className="text-sm font-bold text-blue-700">{data.exam.writtenScore}</div>
                </div>
                <div className="rounded-lg bg-white p-2 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-medium">Grand Total</div>
                  <div className="text-sm font-black text-slate-900">{data.exam.totalScore}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Result Status:</span>
                {data.exam.isPassed ? (
                  <Badge className="bg-emerald-600 text-white font-bold">PASSED</Badge>
                ) : (
                  <Badge className="bg-rose-600 text-white font-bold">FAILED</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Section Filter Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 no-print">
            <button
              onClick={() => setFilterSection('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                filterSection === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Complete Paper ({data.mcqQuestions.length + data.narrativeQuestions.length})
            </button>
            <button
              onClick={() => setFilterSection('mcq')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                filterSection === 'mcq'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              MCQ Section ({data.mcqQuestions.length})
            </button>
            <button
              onClick={() => setFilterSection('narrative')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                filterSection === 'narrative'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Narrative Section ({data.narrativeQuestions.length})
            </button>
          </div>

          {/* SECTION 1: Multiple Choice Questions */}
          {(filterSection === 'all' || filterSection === 'mcq') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-100/80 px-4 py-2 rounded-lg border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                  <span>Part A: Multiple Choice Questions (MCQ)</span>
                </h3>
                <span className="text-xs font-semibold text-slate-600">
                  {data.mcqQuestions.filter((q) => q.isCorrect).length} of {data.mcqQuestions.length} Correct
                </span>
              </div>

              <div className="space-y-3">
                {data.mcqQuestions.map((q, qIndex) => (
                  <div
                    key={q.questionId}
                    className={`rounded-xl border p-4 transition-all ${
                      q.isCorrect
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : q.candidateAnswerId
                        ? 'border-rose-200 bg-rose-50/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start space-x-2.5">
                        <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-slate-200 text-slate-800 text-xs font-bold">
                          {qIndex + 1}
                        </span>
                        <p className="text-sm font-semibold text-slate-900 leading-snug">
                          {q.questionText}
                        </p>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        {q.isCorrect ? (
                          <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>+{q.awardedMarks} Mark</span>
                          </span>
                        ) : q.candidateAnswerId ? (
                          <span className="inline-flex items-center space-x-1 text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>0 Marks</span>
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            Unanswered (0)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pl-8">
                      {q.options.map((opt, optIdx) => {
                        const isChosen = q.candidateAnswerId === opt.answerId;
                        const isCorrectKey = opt.isCorrectOption;

                        let optClass = 'border-slate-200 bg-white text-slate-700';
                        if (isCorrectKey && isChosen) {
                          optClass = 'border-emerald-400 bg-emerald-100/60 font-semibold text-emerald-900 shadow-xs';
                        } else if (isCorrectKey) {
                          optClass = 'border-emerald-300 bg-emerald-50 text-emerald-900 font-medium';
                        } else if (isChosen) {
                          optClass = 'border-rose-400 bg-rose-100/60 font-semibold text-rose-900';
                        }

                        return (
                          <div
                            key={opt.answerId}
                            className={`flex items-start space-x-2 rounded-lg border p-2.5 text-xs transition-colors ${optClass}`}
                          >
                            <span className="font-bold flex-shrink-0 text-slate-500">
                              ({serialLetter(optIdx)})
                            </span>
                            <span className="flex-1 leading-normal">{opt.answerDetails}</span>
                            {isChosen && (
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider flex-shrink-0 ${
                                isCorrectKey ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                              }`}>
                                Candidate's Choice
                              </span>
                            )}
                            {isCorrectKey && !isChosen && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider bg-emerald-200 text-emerald-900 flex-shrink-0">
                                Correct Key
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: Narrative & Written Questions */}
          {(filterSection === 'all' || filterSection === 'narrative') && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between bg-slate-100/80 px-4 py-2 rounded-lg border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                  <span>Part B: Written & Narrative Answer Sheets</span>
                </h3>
                <span className="text-xs font-semibold text-slate-600">
                  {data.narrativeQuestions.length} Questions Evaluated
                </span>
              </div>

              <div className="space-y-4">
                {data.narrativeQuestions.map((nq, nIndex) => (
                  <div
                    key={nq.questionId}
                    className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs"
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-2.5">
                        <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                          W{nIndex + 1}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-snug">
                            {nq.questionText}
                          </p>
                          <span className="text-xs text-slate-500 font-medium">
                            Max Marks: {nq.maxMarks}
                          </span>
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        <div className="text-xs text-slate-500 font-medium">Awarded Score</div>
                        <div className="text-base font-black text-blue-700">
                          {nq.awardedMarks} / {nq.maxMarks}
                        </div>
                      </div>
                    </div>

                    {/* Candidate's Submitted Response */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700">
                        <span className="flex items-center space-x-1.5 text-blue-700">
                          <FileText className="h-3.5 w-3.5" />
                          <span>Candidate's Submitted Answer Paper:</span>
                        </span>
                        <span className="text-[10px] text-slate-500 lowercase">written response</span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans bg-white p-3 rounded-md border border-slate-200/80">
                        {nq.candidateAnswerText || 'No written response recorded by candidate.'}
                      </p>
                    </div>

                    {/* Official Model Answer */}
                    {nq.modelAnswer && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3.5 space-y-1.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center space-x-1.5">
                          <HelpCircle className="h-3.5 w-3.5 text-amber-700" />
                          <span>Official Reference / Model Answer:</span>
                        </div>
                        <p className="text-xs text-amber-950 leading-relaxed whitespace-pre-wrap bg-white/70 p-3 rounded-md border border-amber-200/60">
                          {nq.modelAnswer}
                        </p>
                      </div>
                    )}

                    {/* Examiner Feedback & Remarks */}
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3.5 space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-indigo-900">
                        <span className="flex items-center space-x-1.5">
                          <Award className="h-3.5 w-3.5 text-indigo-700" />
                          <span>Examiner Evaluation & Feedback:</span>
                        </span>
                        <span className="text-indigo-700 font-bold">{nq.awardedMarks} Marks Awarded</span>
                      </div>
                      <p className="text-xs text-indigo-950 italic">
                        "{nq.examinerRemarks || 'Assessed and approved.'}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer certification */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
            Certified examination record generated for {data.candidate.name} ({data.candidate.loginId}) • {data.candidate.companyName || 'Orion Group'}
          </div>
        </div>
      )}
    </Dialog>
  );
};
