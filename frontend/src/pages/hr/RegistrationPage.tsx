import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, UserCheck, UserPlus, AlertCircle, CheckCircle, Building, Briefcase, MapPin, Award } from 'lucide-react';
import { ExamBatch, QuestionSet } from '@/types';

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

  useEffect(() => {
    const initData = async () => {
      try {
        const [resBatches, resSets, resLookups] = await Promise.all([
          api.get('/batches'),
          api.get('/questions/sets'),
          api.get('/lookups/basic')
        ]);
        setBatches(resBatches.data);
        if (resBatches.data.length > 0) setSelectedBatchId(resBatches.data[0].batchId);

        setSets(resSets.data);
        if (resSets.data.length > 0) setSelectedSetId(resSets.data[0].setId);

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
    } catch (err: any) {
      setSearchError(err.response?.data?.message || 'Failed to register examinee.');
    } finally {
      setSubmitting(false);
    }
  };

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
    </div>
  );
};
