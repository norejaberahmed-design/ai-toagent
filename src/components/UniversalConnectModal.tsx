import React, { useState } from 'react';
import {
  X,
  Database,
  FileSpreadsheet,
  FileText,
  Building2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Lock,
  ArrowRight,
  ShieldCheck,
  Server,
  Cloud,
} from 'lucide-react';
import { universalConnectorRegistry } from '../connectors/universal/registry';
import {
  ConnectionConfig,
  ConnectionTestResult,
  BusinessReadinessStatus,
} from '../connectors/universal/types';
import {
  processUniversalConnectorData,
  PipelineExecutionResult,
} from '../connectors/universal/universalPipeline';

interface UniversalConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectSuccess: (result: PipelineExecutionResult) => void;
}

export const UniversalConnectModal: React.FC<UniversalConnectModalProps> = ({
  isOpen,
  onClose,
  onConnectSuccess,
}) => {
  const [selectedId, setSelectedId] = useState<string>('postgresql');
  const [step, setStep] = useState<'select' | 'configure' | 'verifying' | 'result'>('select');

  // SQL connection form
  const [host, setHost] = useState('');
  const [port, setPort] = useState<number | undefined>(undefined);
  const [database, setDatabase] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(false);

  // File upload state
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState('');

  // API credentials state
  const [apiKey, setApiKey] = useState('');
  const [companyId, setCompanyId] = useState('');

  // Execution & Status state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [pipelineResult, setPipelineResult] = useState<PipelineExecutionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const catalog = universalConnectorRegistry.getAllMetadata();
  const activeMeta = catalog.find((c) => c.id === selectedId) || catalog[0];

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setStep('configure');
    setTestResult(null);
    setPipelineResult(null);
    setErrorMsg(null);
    if (id === 'postgresql') {
      setPort(5432);
    } else if (id === 'mysql') {
      setPort(3306);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result instanceof ArrayBuffer) {
        setFileBuffer(event.target.result);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const buildConfig = (): ConnectionConfig => {
    return {
      host: host.trim() || undefined,
      port: port || undefined,
      database: database.trim() || undefined,
      user: user.trim() || undefined,
      password: password || undefined,
      ssl,
      fileBuffer: fileBuffer || undefined,
      fileName,
      apiKey: apiKey.trim() || undefined,
      companyId: companyId.trim() || undefined,
    };
  };

  const handleTestOnly = async () => {
    setErrorMsg(null);
    setTesting(true);
    try {
      const connector = universalConnectorRegistry.get(selectedId);
      if (!connector) throw new Error('الموصل غير معرف.');

      const config = buildConfig();
      const res = await connector.testConnection(config);
      setTestResult(res);
      if (!res.ok) {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل فحص الاتصال.');
    } finally {
      setTesting(false);
    }
  };

  const handleConnectAndProcess = async () => {
    setErrorMsg(null);
    setStep('verifying');
    setTesting(true);
    try {
      const connector = universalConnectorRegistry.get(selectedId);
      if (!connector) throw new Error('الموصل غير معرف.');

      const config = buildConfig();
      const connectRes = await connector.connect(config);

      if (!connectRes.ok) {
        setTestResult(connectRes);
        setErrorMsg(connectRes.message);
        setStep('configure');
        setTesting(false);
        return;
      }

      // Pipeline: Discover -> Ingest -> Semantic -> Unified Model -> Metrics
      const pipeRes = await processUniversalConnectorData(connector);
      setPipelineResult(pipeRes);
      setStep('result');
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء معالجة بيانات المصدر.');
      setStep('configure');
    } finally {
      setTesting(false);
    }
  };

  const handleFinish = () => {
    if (pipelineResult) {
      onConnectSuccess(pipelineResult);
      onClose();
    }
  };

  const renderStatusBadge = (status: BusinessReadinessStatus) => {
    switch (status) {
      case 'analyzable':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            البيانات قابلة للتحليل
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            بيانات جزئية (ناقصة)
          </span>
        );
      case 'contradiction':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-full text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            تعارض يحتاج مراجعة
          </span>
        );
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            متصل
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 text-neutral-700 border border-neutral-300 rounded-full text-xs font-semibold">
            غير متصل
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
              <Database className="w-5 h-5 text-neutral-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900">ربط مصدر بيانات جديد</h2>
              <p className="text-xs text-neutral-500">
                الحقيقة قبل الذكاء · صلاحية قراءة فقط صارمة ومحمية
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Step 1: Select Source */}
          {step === 'select' && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-neutral-800">
                اختر نوع النظام أو مصدر البيانات المراد ربطه:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {catalog.map((cat) => {
                  const isReady = cat.status === 'ready';
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleSelect(cat.id)}
                      className="p-4 border rounded-xl text-right transition-all flex flex-col justify-between hover:border-neutral-900 hover:bg-neutral-50/70 border-neutral-200 group cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="p-2 rounded-lg bg-neutral-100 group-hover:bg-neutral-200 text-neutral-700">
                          {cat.category === 'sql_server' ? (
                            <Server className="w-5 h-5" />
                          ) : cat.category === 'file' ? (
                            <FileSpreadsheet className="w-5 h-5" />
                          ) : (
                            <Cloud className="w-5 h-5" />
                          )}
                        </div>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            isReady
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                          }`}
                        >
                          {isReady ? 'مكتمل الربط' : 'قالب الربط جاهز'}
                        </span>
                      </div>
                      <div className="mt-3">
                        <div className="font-bold text-neutral-900 text-sm">{cat.displayNameAr}</div>
                        <div className="text-xs text-neutral-500 mt-1 line-clamp-2">
                          {cat.descriptionAr}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 'configure' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-500">المصدر المختار:</span>
                  <span className="text-sm font-bold text-neutral-900">{activeMeta.displayNameAr}</span>
                </div>
                <button
                  onClick={() => setStep('select')}
                  className="text-xs text-neutral-600 hover:text-neutral-900 underline flex items-center gap-1 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  تغيير المصدر
                </button>
              </div>

              {/* Security Policy Reminder */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs text-neutral-600">
                  <span className="font-bold text-neutral-800">حماية القراءة فقط مفروضة: </span>
                  لا يُسمح بأي عمليات تعديل أو كتابة نهائياً. بيانات الاعتماد لا تُحفظ في المتصفح.
                </div>
              </div>

              {/* SQL Server Config Form */}
              {activeMeta.category === 'sql_server' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-semibold text-neutral-700">المضيف (Host)</label>
                      <input
                        type="text"
                        placeholder="مثال: localhost أو db.mycompany.com"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 text-left"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-700">المنفذ (Port)</label>
                      <input
                        type="number"
                        placeholder={activeMeta.id === 'postgresql' ? '5432' : '3306'}
                        value={port || ''}
                        onChange={(e) => setPort(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 text-left"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-700">اسم قاعدة البيانات</label>
                      <input
                        type="text"
                        placeholder="مثال: company_pos_db"
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 text-left"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-700">اسم المستخدم (Read-Only User)</label>
                      <input
                        type="text"
                        placeholder="مثال: readonly_user"
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 text-left"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-700">كلمة المرور (تُستخدم خلفياً فقط)</label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 text-left"
                      dir="ltr"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="ssl-check"
                      checked={ssl}
                      onChange={(e) => setSsl(e.target.checked)}
                      className="rounded border-neutral-300 text-neutral-900"
                    />
                    <label htmlFor="ssl-check" className="text-xs text-neutral-700 cursor-pointer">
                      تفعيل الاتصال المشفر الآمن (SSL / TLS)
                    </label>
                  </div>
                </div>
              )}

              {/* File Upload Form */}
              {activeMeta.category === 'file' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:bg-neutral-50 transition-colors">
                    <input
                      type="file"
                      id="universal-file-upload"
                      className="hidden"
                      accept={
                        activeMeta.id === 'sqlite'
                          ? '.db,.sqlite,.sqlite3'
                          : activeMeta.id === 'excel'
                          ? '.xlsx,.xls'
                          : '.csv'
                      }
                      onChange={handleFileUpload}
                    />
                    <label
                      htmlFor="universal-file-upload"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                    >
                      <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-600">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <div className="text-sm font-bold text-neutral-800">
                        {fileName || 'اضغط هنا لاختيار الملف'}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {activeMeta.id === 'sqlite'
                          ? 'يقبل ملفات SQLite (.db, .sqlite)'
                          : activeMeta.id === 'excel'
                          ? 'يقبل مصنفات Excel (.xlsx, .xls)'
                          : 'يقبل ملفات CSV النصية المجدولة'}
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* API Integration Form */}
              {(activeMeta.category === 'erp_api' || activeMeta.category === 'accounting_api') && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                    <span className="font-bold">تكامل معتمد: </span>
                    تم تجهيز عقد الربط المعماري لنظام {activeMeta.displayNameAr}. يتطلب الاتصال تزويد مفاتيح
                    الـ API الخاصة بشركتكم وتفويض القراءة فقط.
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-700">معرف الشركة / المستأجر (Company ID)</label>
                    <input
                      type="text"
                      placeholder="مثال: org_987654321"
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg text-left"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-700">مفتاح الوصول (API Key / Token)</label>
                    <input
                      type="password"
                      placeholder="sk_live_••••••••••••"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg text-left"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>{errorMsg}</div>
                </div>
              )}

              {/* Test Connection Result Box */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    testResult.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                  {renderStatusBadge(testResult.businessStatus)}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={handleTestOnly}
                  disabled={testing}
                  className="px-4 py-2 text-xs font-semibold border border-neutral-300 rounded-xl hover:bg-neutral-50 text-neutral-700 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  اختبار الاتصال فقط
                </button>
                <button
                  type="button"
                  onClick={handleConnectAndProcess}
                  disabled={testing}
                  className="px-5 py-2 text-xs font-bold bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  الاتصال والتحقق من البيانات
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Verifying */}
          {step === 'verifying' && (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mx-auto animate-pulse">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <div className="text-base font-bold text-neutral-900">
                  جارٍ الاتصال، الاكتشاف، والتحقق الحتمي...
                </div>
                <div className="text-xs text-neutral-500">
                  اتصال ← اختبار قراءة فقط ← اكتشاف الجداول ← بناء النموذج الموحد
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 'result' && pipelineResult && (
            <div className="space-y-5">
              <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-neutral-900 text-sm">
                    {pipelineResult.sourceDisplayName}
                  </div>
                  {renderStatusBadge(pipelineResult.businessStatus)}
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {pipelineResult.statusMessageAr}
                </p>
              </div>

              {/* Executive Business Metrics Summary (Clean, Zero SQL jargon) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                  <div className="text-xs text-neutral-500">الجداول المكتشفة</div>
                  <div className="text-base font-bold text-neutral-900 mt-0.5">
                    {pipelineResult.tablesDiscoveredCount} جداول
                  </div>
                </div>
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                  <div className="text-xs text-neutral-500">السجلات المستخلصة</div>
                  <div className="text-base font-bold text-neutral-900 mt-0.5">
                    {pipelineResult.totalRecordsRead.toLocaleString('ar-SA')} سجل
                  </div>
                </div>
              </div>

              {pipelineResult.hasContradictions && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    تنبيه تعارض في السجلات:
                  </div>
                  <ul className="text-xs text-rose-800 list-disc list-inside space-y-0.5">
                    {pipelineResult.contradictionDetails?.slice(0, 3).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-end pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={handleFinish}
                  className="px-6 py-2.5 text-xs font-bold bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  اعتماد المصدر وبدء التحليل
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
