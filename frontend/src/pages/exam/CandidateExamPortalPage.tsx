import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { useSystemConfig } from '@/context/SystemConfigContext';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, Circle, AlertCircle, Send, CheckCircle, FileText } from 'lucide-react';
import { CandidateAnswerPaperModal } from '@/components/exam/CandidateAnswerPaperModal';

export const CandidateExamPortalPage: React.FC = () => {
  const { registrationId } = useParams<{ registrationId: string }>();
  const navigate = useNavigate();
  const { config } = useSystemConfig();

  const [examData, setExamData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(3600);
  const [answers, setAnswers] = useState<Record<number, { answerId?: number; answer?: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);
  const [paperModalOpen, setPaperModalOpen] = useState(false);

  const timerRef = useRef<any>(null);

  const fetchExamPaper = useCallback(async () => {
    try {
      const res = await api.get(`/exam/paper/${registrationId}`);
      setExamData(res.data);
      setRemainingSeconds(res.data.remainingSeconds || 3600);

      if (res.data.isExamEnd) {
        setIsSubmitted(true);
      } else if (res.data.examStart) {
        setHasStarted(true);
      }

      if (res.data.savedAnswers) {
        setAnswers(res.data.savedAnswers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [registrationId]);

  useEffect(() => {
    fetchExamPaper();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchExamPaper]);

  // Timer countdown
  useEffect(() => {
    if (hasStarted && !isSubmitted) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasStarted, isSubmitted]);

  const handleStartExam = async () => {
    try {
      const res = await api.post(`/exam/start/${registrationId}`);
      setRemainingSeconds(res.data.remainingSeconds);
      setHasStarted(true);
      await fetchExamPaper();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to start examination.');
    }
  };

  const handleSelectMCQ = async (questionId: number, answerId: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { answerId },
    }));

    // Auto-save
    try {
      await api.post('/exam/save-answer', {
        examineeId: Number(registrationId),
        questionId,
        answerId,
      });
    } catch (err) {
      console.error('Failed to auto-save MCQ answer', err);
    }
  };

  const handleNarrativeChange = (questionId: number, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], answer: text },
    }));
  };

  const handleNarrativeBlur = async (questionId: number) => {
    const ans = answers[questionId]?.answer;
    try {
      await api.post('/exam/save-answer', {
        examineeId: Number(registrationId),
        questionId,
        answer: ans || '',
      });
    } catch (err) {
      console.error('Failed to auto-save narrative answer', err);
    }
  };

  const handleSubmit = async () => {
    if (!confirm('Are you sure you want to finalize and submit your exam? You cannot make changes once submitted.')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post(`/exam/submit/${registrationId}`);
      setSubmissionResult(res.data);
      setIsSubmitted(true);
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit exam.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = async () => {
    try {
      const res = await api.post(`/exam/submit/${registrationId}`);
      setSubmissionResult(res.data);
      setIsSubmitted(true);
    } catch (err) {
      console.error(err);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading examination environment...</div>;
  }

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
        <div className="mx-auto flex flex-col items-center justify-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-white p-2 border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
            <CompanyLogo className="h-full w-full object-contain" />
          </div>
          <div className="text-xs font-black uppercase tracking-wider text-blue-600">
            {config?.companyName || 'ORION'}
          </div>
        </div>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">Examination Successfully Submitted!</h2>
          <p className="text-sm text-slate-500">
            Your answers have been recorded securely. Multiple choice questions have been graded automatically, and written sections have been queued for examiner review.
          </p>
        </div>

        {submissionResult && (
          <Card className="border-slate-200 bg-slate-50 p-6 text-left space-y-3">
            <div className="text-sm font-semibold text-slate-700">Submission Receipt:</div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Automatic MCQ Score:</span>
              <span className="font-bold text-emerald-700">{submissionResult.mcqScore} Marks</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Narrative Answers:</span>
              <span className="font-semibold text-blue-600">Sent to Faculty Examiner</span>
            </div>
          </Card>
        )}

        <div className="flex items-center justify-center space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPaperModalOpen(true)}
            className="flex items-center space-x-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
          >
            <FileText className="h-4 w-4" />
            <span>View Submitted Answer Paper</span>
          </Button>
          <Button onClick={() => navigate('/dashboard')} className="bg-blue-600 hover:bg-blue-700">
            Return to Dashboard
          </Button>
        </div>

        {/* Candidate Answer Paper Modal */}
        <CandidateAnswerPaperModal
          examineeId={Number(registrationId)}
          open={paperModalOpen}
          onOpenChange={setPaperModalOpen}
        />
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border-slate-200 shadow-md">
          <CardHeader className="text-center space-y-3 border-b pb-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 border border-slate-200 shadow-sm">
              <CompanyLogo className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-blue-600 mb-1">
                {config?.companyName || 'ORION'}
              </div>
              <Badge className="bg-blue-100 text-blue-800 mx-auto">Candidate Assessment</Badge>
            </div>
            <CardTitle className="text-2xl">{examData?.batchName}</CardTitle>
            <CardDescription>{examData?.setName}</CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-4 text-sm text-slate-700 leading-relaxed">
            <h4 className="font-bold text-slate-900 text-base">Examination Instructions & Guidelines:</h4>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Total allotted time for this examination is <strong>60 minutes</strong>.</li>
              <li>Once you click <strong>"Start Examination Now"</strong>, the timer begins immediately and cannot be paused.</li>
              <li>All answers are saved automatically as you make selections.</li>
              <li>When the countdown timer reaches 00:00, your exam will be automatically submitted.</li>
              <li>Do not refresh or close your browser tab during the test.</li>
            </ul>
          </CardContent>

          <CardFooter className="pt-0">
            <Button onClick={handleStartExam} className="w-full bg-blue-600 hover:bg-blue-700 text-base py-6">
              Start Examination Now
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Sticky Countdown Header */}
      <div className="sticky top-4 z-30 flex items-center justify-between rounded-xl bg-slate-900 px-6 py-4 text-white shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-lg bg-white p-1 flex items-center justify-center overflow-hidden flex-shrink-0">
            <CompanyLogo className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
              {config?.companyName || 'ORION'}
            </div>
            <h3 className="font-bold text-base leading-tight">{examData?.batchName}</h3>
            <p className="text-xs text-slate-400">{examData?.setName}</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className={`flex items-center space-x-2 font-mono text-xl font-bold px-3 py-1 rounded-lg ${
            remainingSeconds < 300 ? 'bg-red-600 animate-pulse text-white' : 'bg-slate-800 text-emerald-400'
          }`}>
            <Clock className="h-5 w-5" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
            {isSubmitting ? 'Submitting...' : 'Submit Exam'}
          </Button>
        </div>
      </div>

      {/* Questions Form */}
      <div className="space-y-6">
        {examData?.questions?.map((q: any, qIdx: number) => (
          <Card key={q.questionId} className="border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                  {qIdx + 1}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  {q.typeId === 1 ? 'Multiple Choice (MCQ)' : 'Descriptive / Written'}
                </span>
              </div>
              <Badge variant="outline" className="text-xs">
                Marks: {q.marks}
              </Badge>
            </div>

            <CardContent className="p-6 space-y-4">
              <div className="text-base font-semibold text-slate-900 whitespace-pre-wrap">{q.question}</div>

              {q.typeId === 1 ? (
                <div className="space-y-2 pt-2">
                  {q.answers?.map((ans: any, oIdx: number) => {
                    const isSelected = answers[q.questionId]?.answerId === ans.answerId;
                    return (
                      <div
                        key={ans.answerId}
                        onClick={() => handleSelectMCQ(q.questionId, ans.answerId)}
                        className={`flex items-center space-x-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-medium ring-1 ring-blue-600'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="mt-0.5">
                          {isSelected ? (
                            <CheckCircle2 className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Circle className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <span className="font-semibold text-xs text-slate-500">
                          {String.fromCharCode(65 + oIdx)}.
                        </span>
                        <span className="text-sm flex-1">{ans.answerDetails}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Type Your Detailed Answer Below:
                  </label>
                  <textarea
                    rows={6}
                    value={answers[q.questionId]?.answer || ''}
                    onChange={(e) => handleNarrativeChange(q.questionId, e.target.value)}
                    onBlur={() => handleNarrativeBlur(q.questionId)}
                    placeholder="Write your explanation, steps, or code here. Auto-saved upon clicking outside..."
                    className="w-full rounded-md border border-slate-300 p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <div className="text-[11px] text-slate-400 text-right">
                    Auto-saved when you finish typing.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center py-6">
        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-3 text-base">
          {isSubmitting ? 'Submitting...' : 'Finish & Submit All Answers'}
        </Button>
      </div>
    </div>
  );
};
