import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  UserCheck, 
  UserPlus, 
  AlertCircle, 
  CheckCircle, 
  Building, 
  Briefcase, 
  MapPin, 
  Award,
  Users,
  RefreshCw,
  Filter
} from 'lucide-react';
import { ExamBatch, QuestionSet, ExamRegistration } from '@/types';

export const RegistrationPage: React.FC = () => {
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [basicLookups, setBasicLookups] = useState<Record<string, any[]>>({});

  // Form selections
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [selectedSetId, setSelectedSetId] = useState<number>(0);
  const [promotedGradeId, setPromotedGradeId] = useState<number | undefined>();

  // Employee search
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundEmployee, setFoundEmployee] = useState<any | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Submit status
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Batch Roster states
  const [registrations, setRegistrations] = useState<ExamRegistration[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterSetFilter, setRosterSetFilter] = useState<number>(0);

  useEffect(() => {
    const initData = async () => {
      try {
        const [resBatches, resSets, resLookups] = await Promise.all([
          api.get('/batches'),
          api.get('/questions/sets'),
          api.get('/lookups/basic')
        ]);
        const activeBatches = (resBatches.data || []).filter((b: ExamBatch) => b.isActive !== false);
        setBatches(activeBatches);
        if (activeBatches.length > 0) setSelectedBatchId(activeBatches[0].batchId);

        const activeSets = (resSets.data || []).filter((s: QuestionSet) => s.isActive !== false);
        setSets(activeSets);
        if (activeSets.length > 0) setSelectedSetId(activeSets[0].setId);

        setBasicLookups(resLookups.data);
      } catch (err) {
        console.error(err);
      }
    };
    initData();
  }, []);

  const handleSearchEmployee = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setFoundEmployee(null);

    try {
      const res = await api.get('/registrations/search-employee', { params: { query: searchQuery.trim() } });
      setFoundEmployee(res.data);
    } catch (err: any) {
      setSearchError(err.response?.data?.message || 'Employee not found with provided ID or Name.');
    } finally {
      setSearching(false);
    }
  };

  const fetchRegistrations = async (batchId?: number) => {
    const targetBatchId = batchId !== undefined ? batchId : selectedBatchId;
    if (targetBatchId <= 0) {
      setRegistrations([]);
      return;
    }
    setLoadingRegistrations(true);
    try {
      const res = await api.get('/registrations', {
        params: { batchId: targetBatchId },
      });
      setRegistrations(res.data);
    } catch (err) {
      console.error('Failed to load batch registrations:', err);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  useEffect(() => {
    if (selectedBatchId > 0) {
      fetchRegistrations(selectedBatchId);
    }
  }, [selectedBatchId]);

  const handleRegister = async () => {
    if (!foundEmployee || selectedBatchId <= 0 || selectedSetId <= 0) return;

    setSubmitting(true);
    setSuccessMessage(null);
    setSearchError(null);

    try {
      const res = await api.post('/registrations', {
        loginId: foundEmployee.loginId,
        batchId: selectedBatchId,
        questionSetId: selectedSetId,
        promotedGradeId: promotedGradeId ? Number(promotedGradeId) : null
      });

      setSuccessMessage(`Candidate ${foundEmployee.name} (${foundEmployee.loginId}) successfully registered!`);
      setFoundEmployee(null);
      setSearchQuery('');
      fetchRegistrations(selectedBatchId);
    } catch (err: any) {
      setSearchError(err.response?.data?.message || 'Failed to register examinee.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentBatch = batches.find((b) => b.batchId === selectedBatchId);

  const filteredRegistrations = registrations.filter((r) => {
    if (rosterSetFilter > 0 && r.questionSetId !== rosterSetFilter) return false;
    if (!rosterSearch.trim()) return true;
    const q = rosterSearch.toLowerCase();
    return (
      r.loginId.toLowerCase().includes(q) ||
      r.examineeName.toLowerCase().includes(q) ||
      (r.departmentName && r.departmentName.toLowerCase().includes(q)) ||
      (r.designation && r.designation.toLowerCase().includes(q)) ||
      (r.companyName && r.companyName.toLowerCase().includes(q)) ||
      (r.setName && r.setName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 w-full">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Examinee Candidate Registration</h2>
        <p className="text-sm text-slate-500">Register employees into active exam batches and map appropriate question sets.</p>
      </div>

      {successMessage && (
        <div className="flex items-center space-x-2 rounded-md bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Step 1: Exam Batch & Set Selection */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center space-x-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              1
            </span>
            <span>Target Exam Batch & Question Set</span>
          </CardTitle>
          <CardDescription>Select the batch campaign and paper set the employee will take.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Exam Batch</label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              {batches.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.examName} ({b.examYear})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Question Set</label>
            <select
              value={selectedSetId}
              onChange={(e) => setSelectedSetId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              {sets.map((s) => (
                <option key={s.setId} value={s.setId}>
                  {s.setName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Promoted Target Grade (Optional)</label>
            <select
              value={promotedGradeId || ''}
              onChange={(e) => setPromotedGradeId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="">-- As Current Grade --</option>
              {basicLookups['Grade']?.map((g) => (
                <option key={g.lookupId} value={g.lookupId}>
                  {g.lookupText}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Employee Search */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center space-x-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              2
            </span>
            <span>Search Employee by ID or Name</span>
          </CardTitle>
          <CardDescription>Enter employee ID to pull verified HR records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchEmployee()}
              placeholder="Enter Employee ID (e.g. examinee or employee code)..."
              className="max-w-md"
            />
            <Button onClick={handleSearchEmployee} disabled={searching} className="bg-slate-800 hover:bg-slate-900">
              {searching ? 'Searching...' : 'Search Employee'}
            </Button>
          </div>

          {searchError && (
            <div className="flex items-center space-x-2 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {foundEmployee && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-6 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-blue-100 pb-4">
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{foundEmployee.name}</h4>
                  <div className="text-xs font-semibold text-blue-700">ID: {foundEmployee.loginId}</div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                  Verified Employee
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-500 block">Designation:</span>
                  <span className="text-slate-900 font-medium">{foundEmployee.designation || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block">Department:</span>
                  <span className="text-slate-900 font-medium">{foundEmployee.departmentName || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block">Company:</span>
                  <span className="text-slate-900 font-medium">{foundEmployee.companyName || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block">Current Grade:</span>
                  <span className="text-slate-900 font-medium">{foundEmployee.gradeName || 'N/A'}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleRegister}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-2"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{submitting ? 'Registering...' : 'Confirm Registration'}</span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Batch-wise Registered Employees Section */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center space-x-2 text-slate-900">
                <Users className="h-5 w-5 text-blue-600" />
                <span>Batch Registered Employees</span>
                {currentBatch && (
                  <Badge variant="outline" className="ml-2 font-normal bg-blue-50 text-blue-700 border-blue-200">
                    {currentBatch.examName} ({currentBatch.examYear})
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                All candidates enrolled in the selected exam batch. Automatically updates when new candidates are registered.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-semibold px-2.5 py-1">
                {registrations.length} {registrations.length === 1 ? 'Candidate' : 'Candidates'} Enrolled
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchRegistrations(selectedBatchId)}
                disabled={loadingRegistrations}
                title="Refresh Roster"
                className="h-8 px-2.5 text-xs text-slate-600"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingRegistrations ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-200/60">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search registered candidate by ID, name, designation, department..."
                className="pl-9 h-9 text-sm bg-white"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <select
                value={rosterSetFilter}
                onChange={(e) => setRosterSetFilter(Number(e.target.value))}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm h-9 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full sm:w-auto"
              >
                <option value="0">All Question Sets</option>
                {sets.map((s) => (
                  <option key={s.setId} value={s.setId}>
                    {s.setName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="w-14">#</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Candidate Name</TableHead>
                  <TableHead>Designation & Dept</TableHead>
                  <TableHead>Company & Location</TableHead>
                  <TableHead>Question Set Paper</TableHead>
                  <TableHead>Target Grade</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingRegistrations ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                        <span className="text-sm">Loading registered candidates...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRegistrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <Users className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-700">
                            {rosterSearch.trim() || rosterSetFilter > 0
                              ? 'No candidates match the search filters'
                              : 'No candidates registered in this batch yet'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {rosterSearch.trim() || rosterSetFilter > 0
                              ? 'Try clearing the search text or set filter'
                              : 'Search and confirm an employee registration above to add them to this batch roster.'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegistrations.map((r, index) => (
                    <TableRow key={r.examineeId} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="font-mono text-xs text-slate-400">{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs font-bold text-blue-600">
                        {r.loginId}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {r.examineeName}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <div className="font-medium text-slate-800">{r.designation || '—'}</div>
                        <div className="text-slate-400">{r.departmentName || '—'}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <div className="font-medium text-slate-800">{r.companyName || '—'}</div>
                        <div className="text-slate-400">{r.locationName || '—'}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                          {r.setName || 'Default Set'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {r.examGradeName || r.gradeName || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.isExamEnd ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                            Completed
                          </Badge>
                        ) : r.isAttand ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                            Exam Started
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                            Enrolled
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
