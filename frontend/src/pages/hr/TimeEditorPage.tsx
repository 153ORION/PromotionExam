import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Clock, Plus, CheckCircle, AlertCircle, Users, User } from 'lucide-react';
import { ExamBatch, ExamRegistration } from '@/types';

export const TimeEditorPage: React.FC = () => {
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [registrations, setRegistrations] = useState<ExamRegistration[]>([]);
  const [targetType, setTargetType] = useState<'batch' | 'examinee'>('batch');
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [selectedExamineeId, setSelectedExamineeId] = useState<number>(0);
  const [extraMinutes, setExtraMinutes] = useState<number>(15);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const initData = async () => {
      try {
        const [resBatches, resRegs] = await Promise.all([
          api.get('/batches'),
          api.get('/registrations'),
        ]);
        const activeBatches = (resBatches.data || []).filter((b: ExamBatch) => b.isActive !== false);
        setBatches(activeBatches);
        if (activeBatches.length > 0) setSelectedBatchId(activeBatches[0].batchId);

        setRegistrations(resRegs.data);
        if (resRegs.data.length > 0) setSelectedExamineeId(resRegs.data[0].examineeId);
      } catch (err) {
        console.error(err);
      }
    };
    initData();
  }, []);

  const handleExtendTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (extraMinutes <= 0) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await api.post('/batches/time-editor', {
        batchId: targetType === 'batch' ? selectedBatchId : null,
        examineeId: targetType === 'examinee' ? selectedExamineeId : null,
        extraMinutes: Number(extraMinutes),
      });

      setMessage(res.data.message);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to extend time.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Exam Time Editor</h2>
        <p className="text-sm text-slate-500">
          Dynamically grant extra examination time for network disruptions or technical delays.
        </p>
      </div>

      {message && (
        <div className="flex items-center space-x-2 rounded-md bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <CheckCircle className="h-5 w-5 text-emerald-600" />
          <span className="font-semibold">{message}</span>
        </div>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <CardTitle>Time Extension Control</CardTitle>
          </div>
          <CardDescription>Apply time adjustments to an entire batch or a specific examinee.</CardDescription>
        </CardHeader>

        <form onSubmit={handleExtendTime}>
          <CardContent className="space-y-4">
            {/* Target Radio Selection */}
            <div className="flex space-x-6 border-b pb-4">
              <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === 'batch'}
                  onChange={() => setTargetType('batch')}
                  className="h-4 w-4 text-blue-600"
                />
                <Users className="h-4 w-4 text-slate-500" />
                <span>Entire Exam Batch</span>
              </label>

              <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === 'examinee'}
                  onChange={() => setTargetType('examinee')}
                  className="h-4 w-4 text-blue-600"
                />
                <User className="h-4 w-4 text-slate-500" />
                <span>Individual Examinee</span>
              </label>
            </div>

            {targetType === 'batch' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Select Exam Batch</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  {batches.map((b) => (
                    <option key={b.batchId} value={b.batchId}>
                      {b.examName} ({b.examYear}) - Current Duration: {b.examDuration} mins
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Select Registered Examinee</label>
                <select
                  value={selectedExamineeId}
                  onChange={(e) => setSelectedExamineeId(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  {registrations.map((r) => (
                    <option key={r.examineeId} value={r.examineeId}>
                      {r.examineeName} ({r.loginId}) - Examination Batch: {r.batchName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Additional Minutes to Grant</label>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min="1"
                  max="180"
                  value={extraMinutes}
                  onChange={(e) => setExtraMinutes(Number(e.target.value))}
                  className="w-32"
                  required
                />
                <span className="text-sm text-slate-500">minutes</span>
              </div>
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Applying Extension...' : 'Extend Time Now'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
