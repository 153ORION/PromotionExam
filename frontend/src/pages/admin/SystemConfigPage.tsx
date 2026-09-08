import React, { useState, useEffect, useRef } from 'react';
import api from '@/services/api';
import { useSystemConfig } from '@/context/SystemConfigContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Globe, 
  MapPin, 
  Phone, 
  Mail, 
  Upload, 
  Image as ImageIcon, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  Shield,
  Save,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
  Loader2
} from 'lucide-react';

interface SystemConfig {
  configId: number;
  companyName: string;
  companyShortName?: string;
  address?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  logoUrl?: string;
  examTermsNotice?: string;
  hasGeminiApiKey?: boolean;
  hasOpenAiApiKey?: boolean;
  lastUpdatedDate: string;
  updatedBy?: string;
}

export const SystemConfigPage: React.FC = () => {
  const { refreshConfig } = useSystemConfig();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [companyShortName, setCompanyShortName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [examTermsNotice, setExamTermsNotice] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Logo upload preview
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/config');
      const data: SystemConfig = res.data;
      setConfig(data);
      setCompanyName(data.companyName || '');
      setCompanyShortName(data.companyShortName || '');
      setAddress(data.address || '');
      setPhone(data.phone || '');
      setEmail(data.email || '');
      setWebsiteUrl(data.websiteUrl || '');
      setLogoUrl(data.logoUrl || '');
      setExamTermsNotice(data.examTermsNotice || '');
      setHasSavedApiKey(!!data.hasGeminiApiKey || !!data.hasOpenAiApiKey);

      const secretRes = await api.get('/system/config/secrets');
      setGeminiApiKey(secretRes.data.geminiApiKey || secretRes.data.openAiApiKey || '');
      setHasSavedApiKey(!!secretRes.data.hasGeminiApiKey || !!secretRes.data.hasOpenAiApiKey);
      setTestResult(null);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Failed to load system configuration.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleTestGeminiKey = async () => {
    if (!geminiApiKey.trim() && !hasSavedApiKey) {
      setTestResult({ success: false, message: 'Please enter a Gemini API key to test.' });
      return;
    }
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await api.post('/system/config/test-gemini-key', {
        apiKey: geminiApiKey.trim() || undefined
      });
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || 'Failed to connect to Google Gemini API.'
      });
    } finally {
      setTestingKey(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit.');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadLogo = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await api.post('/system/config/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setLogoUrl(res.data.logoUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      setFeedback({ type: 'success', message: 'Company logo uploaded and updated successfully!' });
      fetchConfig();
      refreshConfig();
    } catch (err: any) {
      setFeedback({ 
        type: 'error', 
        message: err.response?.data?.message || 'Failed to upload logo.' 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      alert('Company Name is required.');
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await api.put('/system/config', {
        companyName: companyName.trim(),
        companyShortName: companyShortName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        websiteUrl: websiteUrl.trim(),
        logoUrl: logoUrl.trim(),
        examTermsNotice: examTermsNotice.trim(),
        geminiApiKey: geminiApiKey.trim(),
        openAiApiKey: geminiApiKey.trim(),
      });

      setConfig(res.data);
      setHasSavedApiKey(!!res.data.hasGeminiApiKey || !!res.data.hasOpenAiApiKey || !!geminiApiKey.trim());
      setFeedback({ type: 'success', message: 'System configuration settings saved successfully!' });
      refreshConfig();
    } catch (err: any) {
      setFeedback({ 
        type: 'error', 
        message: err.response?.data?.message || 'Failed to update system settings.' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading system settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            <span>System & Institutional Configuration</span>
          </h2>
          <p className="text-sm text-slate-500">
            Configure institutional profile, branding, official headquarters address, website, and company logo.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center space-x-3 text-sm font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Institutional Preview & Logo Uploader */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Institutional Branding Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center space-y-4">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-2 overflow-hidden shadow-inner">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview Logo" className="h-full w-full object-contain" />
                ) : logoUrl ? (
                  <img src={logoUrl} alt="Company Logo" className="h-full w-full object-contain" onError={(e) => {
                    // Fallback to text initials if image path not found
                    (e.target as HTMLElement).style.display = 'none';
                  }} />
                ) : (
                  <div className="text-center text-slate-400">
                    <ImageIcon className="h-8 w-8 mx-auto" />
                    <span className="text-[10px] mt-1 block">No Logo</span>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">{companyName || 'Institutional Name'}</h3>
                {companyShortName && (
                  <Badge variant="outline" className="mt-1 font-mono text-xs">
                    {companyShortName}
                  </Badge>
                )}
              </div>

              <div className="text-xs text-slate-600 space-y-1.5 text-left bg-slate-50 p-3 rounded-lg border border-slate-100">
                {websiteUrl && (
                  <div className="flex items-center space-x-2 text-blue-600 truncate">
                    <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                      {websiteUrl}
                    </a>
                  </div>
                )}
                {email && (
                  <div className="flex items-center space-x-2 truncate">
                    <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{email}</span>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <span>{phone}</span>
                  </div>
                )}
                {address && (
                  <div className="flex items-start space-x-2 pt-1 border-t border-slate-200/60">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <span className="leading-snug">{address}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Logo Upload Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <Upload className="h-4 w-4 text-blue-600" />
                <span>Upload Company Logo</span>
              </CardTitle>
              <CardDescription>
                PNG, JPG, SVG, or WebP. Max file size: 5MB.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/50"
              >
                <Upload className="h-6 w-6 mx-auto text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-slate-700 block">
                  {selectedFile ? selectedFile.name : 'Click to select logo image'}
                </span>
                <span className="text-[11px] text-slate-400">High resolution transparent PNG recommended</span>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleUploadLogo}
                    disabled={uploading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {uploading ? 'Uploading...' : 'Confirm Logo Upload'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Configuration Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave}>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Organization & Platform Details</CardTitle>
                <CardDescription>
                  These parameters will appear across examination headers, official certificates, and candidate transcripts.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Company / Organization Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Orion Group"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Short Name / Code
                    </label>
                    <Input
                      value={companyShortName}
                      onChange={(e) => setCompanyShortName(e.target.value)}
                      placeholder="e.g. OG"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Official Website Address
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://www.orion-group.net"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Primary Contact Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="info@orion-group.net"
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Phone / Hotline
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+880-2-8870133"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Current Logo Path / URL
                    </label>
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="/uploads/logos/..."
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Corporate Headquarters / Registered Address
                  </label>
                  <textarea
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter full street, area, city, and postal address..."
                    className="w-full rounded-md border border-slate-300 p-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Global Examination Honor Code & Terms Notice
                  </label>
                  <textarea
                    rows={4}
                    value={examTermsNotice}
                    onChange={(e) => setExamTermsNotice(e.target.value)}
                    placeholder="Notice displayed to all examinees prior to taking tests..."
                    className="w-full rounded-md border border-slate-300 p-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-purple-50/40 p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <label className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                        Google Gemini API Key
                      </label>
                      <p className="text-xs text-indigo-900/80 mt-1 leading-relaxed">
                        Powers the AI marking engine: rubric standard answer drafting, multi-dimensional scoring rubric generation, and automated candidate evaluation (Default Model: <code className="bg-indigo-100/80 text-indigo-800 px-1 py-0.5 rounded font-mono text-[11px]">gemini-3.6-flash</code>).
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={hasSavedApiKey ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-300'}>
                        {hasSavedApiKey ? 'Key Configured' : 'Not Set'}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="relative flex items-center">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={geminiApiKey}
                        onChange={(e) => {
                          setGeminiApiKey(e.target.value);
                          setTestResult(null);
                        }}
                        placeholder="AIzaSy..."
                        autoComplete="off"
                        className="pr-24 font-mono text-xs bg-white border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <div className="absolute right-2 flex items-center space-x-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                          title={showApiKey ? "Hide Key" : "Show Key"}
                        >
                          {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        {geminiApiKey && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setGeminiApiKey('');
                              setHasSavedApiKey(false);
                              setTestResult(null);
                            }}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            title="Clear Key"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>Get API key from Google AI Studio</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleTestGeminiKey}
                        disabled={testingKey || (!geminiApiKey.trim() && !hasSavedApiKey)}
                        className="h-8 text-xs bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 flex items-center space-x-1.5 font-medium"
                      >
                        {testingKey ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                            <span>Testing Connection...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                            <span>Test Gemini Connection</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {testResult && (
                      <div className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 border ${
                        testResult.success
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-red-50 text-red-800 border-red-200'
                      }`}>
                        {testResult.success ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                        )}
                        <span className="font-medium">{testResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>

                {config?.lastUpdatedDate && (
                  <div className="pt-2 text-xs text-slate-400 flex items-center justify-between border-t border-slate-100">
                    <span>Last updated: {new Date(config.lastUpdatedDate).toLocaleString()}</span>
                    <span>Updated by: {config.updatedBy || 'admin'}</span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="bg-slate-50 flex items-center justify-between border-t py-4">
                <Button type="button" variant="outline" onClick={fetchConfig}>
                  Reset
                </Button>
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-1.5">
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
};
