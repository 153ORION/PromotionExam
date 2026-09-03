import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '@/services/api';
import { useSystemConfig } from '@/context/SystemConfigContext';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Award, Printer, CheckCircle, XCircle, FileText, Eye, Filter } from 'lucide-react';
import { ExamineeResultSummary, ExamBatch } from '@/types';
import { CandidateAnswerPaperModal } from '@/components/exam/CandidateAnswerPaperModal';

export const ResultViewerPage: React.FC = () => {
  const { config } = useSystemConfig();
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState<ExamineeResultSummary[]>([]);
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Detail Modal / Print view
  const [dialogOpen, setDialogOpen] = useState(false);
  const [examineeDetail, setExamineeDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedPaperExamineeId, setSelectedPaperExamineeId] = useState<number | null>(null);
  const [paperModalOpen, setPaperModalOpen] = useState(false);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await api.get('/batches');
        setBatches(res.data);
        if (res.data.length > 0) setSelectedBatchId(res.data[0].batchId);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBatches();
  }, []);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await api.get('/results/batch', {
        params: { batchId: selectedBatchId > 0 ? selectedBatchId : undefined },
      });
      setResults(res.data);

      // Check if URL has ?examineeId=
      const targetExId = searchParams.get('examineeId');
      if (targetExId) {
        handleViewTranscript(Number(targetExId));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [selectedBatchId]);

  const handleViewTranscript = async (examineeId: number) => {
    setLoadingDetail(true);
    setDialogOpen(true);
    try {
      const res = await api.get(`/results/examinee/${examineeId}`);
      setExamineeDetail(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Exam Results & Transcripts</h2>
          <p className="text-sm text-slate-500">Comprehensive score rankings, pass/fail status, and official scorecards.</p>
        </div>
        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-1">
          <Printer className="h-4 w-4" />
          <span>Print Result Sheet</span>
        </Button>
      </div>

      {/* Filter */}
      <Card className="p-4 border-slate-200 shadow-sm bg-slate-50/50 no-print">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-semibold text-slate-700">Filter by Exam Batch:</span>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm"
          >
            <option value="0">-- All Batches --</option>
            {batches.map((b) => (
              <option key={b.batchId} value={b.batchId}>
                {b.examName} ({b.examYear})
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Leaderboard Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Results Leaderboard</CardTitle>
          <CardDescription>Ranked by highest combined total score.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Department / Company</TableHead>
                <TableHead>Exam Batch</TableHead>
                <TableHead className="text-center">MCQ Score</TableHead>
                <TableHead className="text-center">Written Score</TableHead>
                <TableHead className="text-center font-bold">Total Score</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Transcript</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                    Loading results...
                  </TableCell>
                </TableRow>
              ) : results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                    No results available for this batch yet.
                  </TableCell>
                </TableRow>
              ) : (
                results.map((r, idx) => (
                  <TableRow key={r.examineeId}>
                    <TableCell className="font-bold text-slate-700 text-center">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs mx-auto font-semibold">
                        {idx + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{r.name}</div>
                      <div className="text-xs text-slate-500">ID: {r.loginId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-800">{r.departmentName || 'General'}</div>
                      <div className="text-xs text-slate-500">{r.companyName || 'Orion Group'}</div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{r.batchName}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{r.mcqScore}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{r.writtenScore}</TableCell>
                    <TableCell className="text-center font-bold text-base text-blue-700">
                      {r.totalScore} <span className="text-xs text-slate-400 font-normal">/ {r.totalPossibleMarks}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {r.isPassed ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                          PASSED
                        </Badge>
                      ) : (
                        <Badge variant="destructive">FAILED</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedPaperExamineeId(r.examineeId);
                            setPaperModalOpen(true);
                          }}
                          className="text-xs flex items-center space-x-1 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 shadow-2xs"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Answer Paper</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewTranscript(r.examineeId)}
                          className="text-xs flex items-center space-x-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Transcript</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Official Scorecard Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader className="space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-2 border border-slate-200 shadow-sm overflow-hidden">
            <CompanyLogo className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-blue-600 text-center mb-0.5">
              {config?.companyName || 'ORION'}
            </div>
            <DialogTitle className="text-xl font-bold text-center">
              Official Promotion Examination Scorecard
            </DialogTitle>
            <DialogDescription className="text-center">
              Verified Candidate Assessment Transcript
            </DialogDescription>
          </div>
        </DialogHeader>

        {loadingDetail || !examineeDetail ? (
          <div className="py-12 text-center text-slate-500">Loading transcript...</div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Candidate Header Summary */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-semibold text-slate-500 block">Candidate Name:</span>
                <span className="text-sm font-bold text-slate-900">{examineeDetail.name}</span>
                <span className="text-slate-500 block mt-1">Employee ID: {examineeDetail.loginId}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block">Department & Designation:</span>
                <span className="text-slate-800 font-medium">{examineeDetail.departmentName} ({examineeDetail.designation})</span>
                <span className="text-slate-500 block mt-1">Company: {examineeDetail.companyName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block">Exam Batch:</span>
                <span className="text-slate-800 font-medium">{examineeDetail.batchName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block">Question Paper Set:</span>
                <span className="text-slate-800 font-medium">{examineeDetail.setName}</span>
              </div>
            </div>

            {/* Score Breakdown Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                  <tr>
                    <th className="p-3 text-left">Exam Component</th>
                    <th className="p-3 text-center">Obtained Marks</th>
                    <th className="p-3 text-center">Component Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-800">
                  <tr>
                    <td className="p-3 font-medium">Multiple Choice Questions (MCQ)</td>
                    <td className="p-3 text-center font-bold font-mono">{examineeDetail.mcqScore}</td>
                    <td className="p-3 text-center text-emerald-700 font-semibold">Evaluated</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Descriptive / Narrative Questions</td>
                    <td className="p-3 text-center font-bold font-mono">{examineeDetail.writtenScore}</td>
                    <td className="p-3 text-center text-emerald-700 font-semibold">Evaluated</td>
                  </tr>
                  <tr className="bg-blue-50/70 font-bold text-blue-900 border-t-2 border-blue-200">
                    <td className="p-3 text-base">Grand Total Score</td>
                    <td className="p-3 text-center text-lg font-mono text-blue-700">
                      {examineeDetail.totalScore} / {examineeDetail.totalPossibleMarks}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-3 py-1 rounded bg-emerald-100 text-emerald-800 text-xs uppercase font-bold">
                        {examineeDetail.totalScore >= examineeDetail.totalPossibleMarks * 0.5 ? 'PASSED' : 'FAILED'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Narrative Scoring Breakdown */}
            {examineeDetail.narratives && examineeDetail.narratives.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Detailed Narrative Grading Breakdown
                </h4>
                <div className="space-y-2">
                  {examineeDetail.narratives.map((n: any, idx: number) => (
                    <div key={idx} className="border border-slate-100 rounded-lg p-3 text-xs bg-white space-y-1">
                      <div className="flex justify-between font-semibold text-slate-900">
                        <span>Q{idx + 1}: {n.question}</span>
                        <span className="text-blue-700 font-bold ml-2 whitespace-nowrap">
                          {n.awardedMarks} / {n.maxMarks} Marks
                        </span>
                      </div>
                      {n.remarks && (
                        <div className="text-slate-500 italic">Examiner Feedback: "{n.remarks}"</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="no-print">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSelectedPaperExamineeId(examineeDetail.examineeId);
                  setPaperModalOpen(true);
                }}
                className="flex items-center space-x-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200"
              >
                <FileText className="h-4 w-4" />
                <span>View Full Answer Paper</span>
              </Button>
              <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-1">
                <Printer className="h-4 w-4" />
                <span>Print Scorecard</span>
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>

      {/* Candidate Answer Paper Modal */}
      <CandidateAnswerPaperModal
        examineeId={selectedPaperExamineeId}
        open={paperModalOpen}
        onOpenChange={setPaperModalOpen}
      />
    </div>
  );
};
