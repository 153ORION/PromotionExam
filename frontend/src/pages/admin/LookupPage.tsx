import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, CheckCircle, XCircle, Filter } from 'lucide-react';
import { LookupItem, LookupType } from '@/types';

export const LookupPage: React.FC = () => {
  const [lookups, setLookups] = useState<LookupItem[]>([]);
  const [types, setTypes] = useState<LookupType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLookup, setEditingLookup] = useState<LookupItem | null>(null);
  const [formTypeId, setFormTypeId] = useState<number>(0);
  const [lookupText, setLookupText] = useState('');
  const [lookupTextShort, setLookupTextShort] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTypes = async () => {
    try {
      const res = await api.get('/lookups/types');
      setTypes(res.data);
      if (res.data.length > 0 && selectedTypeId === 0) {
        setSelectedTypeId(res.data[0].typeId);
        setFormTypeId(res.data[0].typeId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLookups = async (typeId?: number) => {
    setLoading(true);
    try {
      const tid = typeId !== undefined ? typeId : selectedTypeId;
      const res = await api.get('/lookups/items', { 
        params: { 
          typeId: tid > 0 ? tid : undefined,
          includeInactive: true 
        } 
      });
      setLookups(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  useEffect(() => {
    if (selectedTypeId > 0) {
      fetchLookups(selectedTypeId);
    }
  }, [selectedTypeId]);

  const handleOpenAdd = () => {
    setEditingLookup(null);
    setFormTypeId(selectedTypeId > 0 ? selectedTypeId : (types[0]?.typeId || 1));
    setLookupText('');
    setLookupTextShort('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: LookupItem) => {
    setEditingLookup(item);
    setFormTypeId(item.typeId);
    setLookupText(item.lookupText);
    setLookupTextShort(item.lookupTextShort || '');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupText.trim() || formTypeId <= 0) return;

    setSubmitting(true);
    try {
      await api.post('/lookups/items', {
        lookupId: editingLookup?.lookupId,
        typeId: formTypeId,
        lookupText: lookupText.trim(),
        lookupTextShort: lookupTextShort.trim() || null
      });
      setDialogOpen(false);
      fetchLookups();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save lookup');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await api.post(`/lookups/items/toggle/${id}`);
      fetchLookups();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Lookup Items</h2>
          <p className="text-sm text-slate-500">Configure dropdown values for Companies, Departments, Locations, Grades, and Years.</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-1">
          <Plus className="h-4 w-4" />
          <span>Add Lookup Item</span>
        </Button>
      </div>

      {/* Filter by Type */}
      <Card className="p-4 border-slate-200 shadow-sm bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm font-semibold text-slate-700">
            <Filter className="h-4 w-4 text-blue-600" />
            <span>Select Lookup Type:</span>
          </div>
          <select
            value={selectedTypeId}
            onChange={(e) => setSelectedTypeId(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            {types.map((t) => (
              <option key={t.typeId} value={t.typeId}>
                {t.lookupType}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Lookup Items</CardTitle>
          <CardDescription>
            Items under selected category ({types.find((t) => t.typeId === selectedTypeId)?.lookupType || 'All'})
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Display Text</TableHead>
                <TableHead>Short Code</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    Loading items...
                  </TableCell>
                </TableRow>
              ) : lookups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No lookup items found for this type.
                  </TableCell>
                </TableRow>
              ) : (
                lookups.map((item) => (
                  <TableRow key={item.lookupId}>
                    <TableCell className="font-mono text-xs text-slate-500">#{item.lookupId}</TableCell>
                    <TableCell className="text-xs font-semibold text-blue-700 bg-blue-50/50 rounded">
                      {item.typeName}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">{item.lookupText}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">{item.lookupTextShort || '-'}</TableCell>
                    <TableCell className="text-slate-600">{item.serial || '-'}</TableCell>
                    <TableCell>
                      {item.isActive ? (
                        <span className="inline-flex items-center text-xs text-emerald-700 font-medium">
                          <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-red-600 font-medium">
                          <XCircle className="h-3.5 w-3.5 mr-1 text-red-500" /> Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleOpenEdit(item)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={item.isActive ? 'destructive' : 'success'}
                        onClick={() => handleToggle(item.lookupId)}
                      >
                        {item.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingLookup ? 'Edit Lookup Item' : 'Add New Lookup Item'}</DialogTitle>
          <DialogDescription>
            Enter the details for this lookup option.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Lookup Type Category</label>
            <select
              value={formTypeId}
              onChange={(e) => setFormTypeId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              required
            >
              {types.map((t) => (
                <option key={t.typeId} value={t.typeId}>
                  {t.lookupType}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Display Text</label>
            <Input
              value={lookupText}
              onChange={(e) => setLookupText(e.target.value)}
              placeholder="e.g. Information Technology, Head Office, Grade-A"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Short Code / Acronym (Optional)</label>
            <Input
              value={lookupTextShort}
              onChange={(e) => setLookupTextShort(e.target.value)}
              placeholder="e.g. IT, HO, G-A"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Saving...' : 'Save Item'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
