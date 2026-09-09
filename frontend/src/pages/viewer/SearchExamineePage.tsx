import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, UserCheck, FileText } from 'lucide-react';
import { ExamRegistration, ExamBatch } from '@/types';
import { CandidateAnswerPaperModal } from '@/components/exam/CandidateAnswerPaperModal';

export const SearchExamineePage: React.FC = () => {
  const [registrations, setRegistrations] = useState<ExamRegistration[]>([]);
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPaperExamineeId, setSelectedPaperExamineeId] = useState<number | null>(null);
  const [paperModalOpen, setPaperModalOpen] = useState(false);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await api.get('/batches');
        const activeBatches = (res.data || []).filter((b: ExamBatch) => b.isActive !== false);
        setBatches(activeBatches);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBatches();
  }, []);

  const fetchRegistrations = async () => {
    if (!selectedBatchId || selectedBatchId <= 0) {
      setRegistrations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/registrations', {
        params: { batchId: selectedBatchId },
      });
      setRegistrations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [selectedBatchId]);

  const filteredRegistrations = registrations.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      r.loginId.toLowerCase().includes(s) ||
      r.examineeName.toLowerCase().includes(s) ||
      (r.departmentName && r.departmentName.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Search Examinee</h2>
        <p className="text-sm text-slate-500">Query and lookup registered candidate test records across departments and batches.</p>
      </div>

      <Card className="p-4 border-slate-200 shadow-sm bg-slate-50/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-semibold text-slate-700">Examination Batch:</span>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm"
            >
              <option value="0">-- Select Batch --</option>
              {batches.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.examName}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search candidate name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
        </div>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Examination Candidate</CardTitle>
          <CardDescription>Records matching selected filters ({filteredRegistrations.length})</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Department / Company</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Question Set</TableHead>
                <TableHead className="text-center">MCQ</TableHead>
                <TableHead className="text-center">Written</TableHead>
                <TableHead className="text-center font-bold">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedBatchId === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-slate-500">
                    Please select an Exam Batch to view examinee records.
                  </TableCell>
                </TableRow>
              ) : loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                    Loading records...
                  </TableCell>
                </TableRow>
              ) : filteredRegistrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                    No examinees found in this batch.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRegistrations.map((r) => (
                  <TableRow key={r.examineeId}>
                    <TableCell className="font-mono text-xs text-slate-500">#{r.examineeId}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{r.examineeName}</div>
                      <div className="text-xs text-slate-500">ID: {r.loginId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-800">{r.departmentName || 'General'}</div>
                      <div className="text-xs text-slate-500">{r.companyName || 'Orion'}</div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{r.batchName || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-700">{r.setName || '-'}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{r.mcqScore ?? '-'}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{r.writtenScore ?? '-'}</TableCell>
                    <TableCell className="text-center font-bold text-sm text-blue-700">
                      {r.totalScore ?? '-'}
                    </TableCell>
                    <TableCell>
                      {r.isExamEnd ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Completed</Badge>
                      ) : r.isAttand ? (
                        <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
                      ) : (
                        <Badge variant="secondary">Registered</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {r.isExamEnd ? (
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
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Candidate Answer Paper Modal */}
      <CandidateAnswerPaperModal
        examineeId={selectedPaperExamineeId}
        open={paperModalOpen}
        onOpenChange={setPaperModalOpen}
      />
    </div>
  );
};
