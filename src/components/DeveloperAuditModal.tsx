import React, { useState } from 'react';
import {
  X,
  Activity,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  Terminal,
  Cpu,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  DeveloperDiagnosticReport,
  SystemHealthReport,
  DiagnosticEvent,
  AuditRecord,
} from '../diagnostics/types';
import { diagnosticLogger } from '../diagnostics/logger';
import { evidenceAuditor } from '../diagnostics/evidence-auditor';
import { generateSystemHealthReport } from '../diagnostics/system-health';

interface DeveloperAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  latestReport: DeveloperDiagnosticReport | null;
  metricsAvailable: boolean;
  hasCostData: boolean;
}

export const DeveloperAuditModal: React.FC<DeveloperAuditModalProps> = ({
  isOpen,
  onClose,
  latestReport,
  metricsAvailable,
  hasCostData,
}) => {
  const [activeTab, setActiveTab] = useState<'trace' | 'dependencies' | 'health' | 'audit' | 'logs'>('trace');
  const [logFilter, setLogFilter] = useState<'all' | 'ERROR' | 'WARNING'>('all');
  const [searchLog, setSearchLog] = useState('');

  if (!isOpen) return null;

  const healthReport: SystemHealthReport = generateSystemHealthReport(
    diagnosticLogger.getEvents(),
    metricsAvailable,
    hasCostData
  );

  const allLogs: DiagnosticEvent[] = diagnosticLogger.getEvents();
  const filteredLogs = allLogs.filter((l) => {
    if (logFilter === 'ERROR' && l.level !== 'ERROR' && l.level !== 'CRITICAL') return false;
    if (logFilter === 'WARNING' && l.level !== 'WARNING') return false;
    if (searchLog && !l.message.toLowerCase().includes(searchLog.toLowerCase()) && !l.component.toLowerCase().includes(searchLog.toLowerCase())) {
      return false;
    }
    return true;
  });

  const auditRecords: AuditRecord[] = evidenceAuditor.getAuditTrail();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-950/70 backdrop-blur-xs font-sans text-neutral-900">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-wide">مرصد التشخيص والتدقيق النظامي (M4.5 Developer Diagnostic View)</h3>
                <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full font-mono border border-neutral-700">
                  {latestReport ? latestReport.analysisId : 'NO_ACTIVE_ANALYSIS'}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                الحقيقة قبل الذكاء · فحص مسارات الحساب وسلاسل الأدلة وأزمنة المعالجة بدقة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-neutral-200 bg-neutral-50 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('trace')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'trace'
                ? 'border-neutral-900 text-neutral-900 font-bold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            مسار التحليل (Trace Steps)
          </button>

          <button
            onClick={() => setActiveTab('dependencies')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'dependencies'
                ? 'border-neutral-900 text-neutral-900 font-bold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            شجرة الاعتمادات (Calculation Diagnostics)
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'health'
                ? 'border-neutral-900 text-neutral-900 font-bold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Cpu className="w-4 h-4" />
            صحة النظام (System Health)
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'border-neutral-900 text-neutral-900 font-bold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            سجل التدقيق (Audit Trail)
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'logs'
                ? 'border-neutral-900 text-neutral-900 font-bold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Terminal className="w-4 h-4" />
            سجل الأحداث (Logs: {allLogs.length})
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-white space-y-6">
          {/* TAB 1: TRACE STEPS */}
          {activeTab === 'trace' && (
            <div className="space-y-6">
              {latestReport ? (
                <>
                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                      <span className="text-[11px] text-neutral-500 block">حالة التحليل</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                          latestReport.finalSystemStatus === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : latestReport.finalSystemStatus === 'BLOCKED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {latestReport.finalSystemStatus}
                      </span>
                    </div>

                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                      <span className="text-[11px] text-neutral-500 block">زمن التحليل الإجمالي</span>
                      <span className="text-xs font-bold text-neutral-900 mt-1 block">
                        {latestReport.durationMs}ms
                      </span>
                    </div>

                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                      <span className="text-[11px] text-neutral-500 block">سلسلة الأدلة</span>
                      <span className="text-xs font-bold text-neutral-900 mt-1 block">
                        {latestReport.evidenceStatus} ({latestReport.evidenceIds.length} معرفات)
                      </span>
                    </div>

                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                      <span className="text-[11px] text-neutral-500 block">نقطة التعثر الأولى</span>
                      <span className="text-xs font-bold text-rose-700 mt-1 block truncate">
                        {latestReport.firstFailurePoint || 'لا يوجد فشل'}
                      </span>
                    </div>
                  </div>

                  {/* Performance Breakdown */}
                  <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                    <div className="text-xs font-bold text-neutral-700 flex items-center justify-between">
                      <span>أزمنة مراحل التحليل (Performance Profiling)</span>
                      <span className="font-mono text-[11px] text-neutral-500">{latestReport.durationMs}ms</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                      <div className="p-2 bg-white rounded-lg border border-neutral-200">
                        <div className="text-[10px] text-neutral-400">تحميل المصدر</div>
                        <div className="font-bold text-neutral-800">{latestReport.performance.data_loading_ms}ms</div>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-neutral-200">
                        <div className="text-[10px] text-neutral-400">فحص الجودة</div>
                        <div className="font-bold text-neutral-800">{latestReport.performance.data_quality_ms}ms</div>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-neutral-200">
                        <div className="text-[10px] text-neutral-400">الحساب المالي</div>
                        <div className="font-bold text-neutral-800">{latestReport.performance.calculation_ms}ms</div>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-neutral-200">
                        <div className="text-[10px] text-neutral-400">سجل الأدلة</div>
                        <div className="font-bold text-neutral-800">{latestReport.performance.evidence_ms}ms</div>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-neutral-200">
                        <div className="text-[10px] text-neutral-400">شرح المستشار</div>
                        <div className="font-bold text-neutral-800">{latestReport.performance.ai_generation_ms}ms</div>
                      </div>
                    </div>
                  </div>

                  {/* Chronological Steps */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-neutral-700">المسار التدقيقي الزمني لعملية التحليل:</h4>
                    <div className="space-y-2 font-mono text-xs">
                      {latestReport.traceSteps.map((step) => (
                        <div
                          key={step.stepNumber}
                          className="p-3 rounded-xl border flex items-start gap-3 bg-neutral-50/50 border-neutral-200"
                        >
                          <div className="text-neutral-400 font-bold shrink-0">#{step.stepNumber}</div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-neutral-900">{step.description}</span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  step.status === 'SUCCESS'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : step.status === 'BLOCKED'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {step.status}
                              </span>
                            </div>
                            {step.details && (
                              <div className="text-neutral-500 text-[11px] mt-1 font-sans">
                                {step.details}
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-400 shrink-0">
                            {new Date(step.timestamp).toLocaleTimeString('ar-SA')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-neutral-400 text-xs">
                  لم يتم تنفيذ أي استعلام تحليلي بعد. اطرح سؤالاً في شاشة «اسأل عن شركتك» لتوليد تقرير تشخيص كامل.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DEPENDENCIES & CALCULATIONS */}
          {activeTab === 'dependencies' && (
            <div className="space-y-6">
              {latestReport && latestReport.calculationSteps.length > 0 ? (
                <div className="space-y-4">
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-neutral-800">قاعدة تتبع الاعتمادات (Section 4 & 5):</div>
                    <p className="text-neutral-600 leading-relaxed">
                      يتم فحص المؤشرات التابعة خطوة بخطوة؛ وفي حال غياب أو فشل مدخل أساسي (مثل التكاليف)، يُحظر تلقائياً حساب صافي وهامش الربح ويُمنع المستشار من تقدير أو تخمين الرقم.
                    </p>
                  </div>

                  <div className="space-y-2.5 font-mono text-xs">
                    {latestReport.calculationSteps.map((calc, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border flex flex-col gap-2 ${
                          calc.status === 'SUCCESS'
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : calc.status === 'BLOCKED'
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-rose-50/50 border-rose-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900 text-sm">
                            {calc.calculation_type}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              calc.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : calc.status === 'BLOCKED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {calc.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-neutral-600 space-y-1 font-sans">
                          {calc.input_dependencies.length > 0 && (
                            <div>
                              <span className="font-bold">الاعتمادات المسبقة: </span>
                              {calc.input_dependencies.join(' ، ')}
                            </div>
                          )}
                          {calc.failure_reason && (
                            <div className="text-rose-700">
                              <span className="font-bold">سبب الحظر / الفشل: </span>
                              {calc.failure_reason}
                            </div>
                          )}
                          <div>
                            <span className="font-bold">إجراء النظام: </span>
                            <span className="font-mono">{calc.action}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-neutral-400 text-xs">
                  لا توجد خطوات حساب مسجلة في الجلسة الحالية.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SYSTEM HEALTH */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                <div>
                  <div className="text-xs text-neutral-500">حالة صحة النظام العامة</div>
                  <div className="text-lg font-bold text-neutral-900 flex items-center gap-2 mt-0.5">
                    {healthReport.overallStatus === 'OK' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    )}
                    {healthReport.overallStatus}
                  </div>
                </div>
                <div className="text-left text-xs text-neutral-400 font-mono">
                  {new Date(healthReport.generatedAt).toLocaleTimeString('ar-SA')}
                </div>
              </div>

              {/* Components Health Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {Object.entries(healthReport.components).map(([comp, status]) => (
                  <div key={comp} className="p-3 rounded-xl border border-neutral-200 bg-white">
                    <span className="text-neutral-500 block text-[11px] capitalize">{comp}</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                        status === 'OK'
                          ? 'bg-emerald-50 text-emerald-700'
                          : status === 'WARNING'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Detected Issues */}
              {healthReport.detectedIssues.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-neutral-700">الملاحظات والمشاكل المرصودة:</h4>
                  <ul className="space-y-1.5 text-xs text-neutral-700">
                    {healthReport.detectedIssues.map((issue, idx) => (
                      <li key={idx} className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Action */}
              {healthReport.recommendedDeveloperAction && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                  <span className="font-bold block">إجراء المبرمج المقترح (Recommended Action):</span>
                  <p>{healthReport.recommendedDeveloperAction}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="text-xs text-neutral-600">
                سجل تدقيقي للأحداث والقرارات الحسابية الصادرة (Immutable Audit Trail):
              </div>
              {auditRecords.length > 0 ? (
                <div className="space-y-2 font-mono text-xs">
                  {auditRecords.map((aud) => (
                    <div key={aud.auditId} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1.5 font-sans">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-neutral-900">{aud.auditId}</span>
                        <span className="text-neutral-400">{new Date(aud.when).toLocaleTimeString('ar-SA')}</span>
                      </div>
                      <div className="text-xs font-semibold text-neutral-800">{aud.what}</div>
                      <div className="text-xs text-neutral-600">{aud.result}</div>
                      <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono pt-1 border-t border-neutral-100">
                        <span>المستخدم: {aud.who}</span>
                        <span>معرف الإثبات: {aud.evidenceId} ({aud.evidenceStatus})</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-neutral-400 text-xs">
                  لا توجد قيود تدقيق مسجلة حتى الآن.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: RAW LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLogFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-sans ${
                      logFilter === 'all' ? 'bg-neutral-900 text-white font-bold' : 'bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    الكل ({allLogs.length})
                  </button>
                  <button
                    onClick={() => setLogFilter('WARNING')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-sans ${
                      logFilter === 'WARNING' ? 'bg-amber-600 text-white font-bold' : 'bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    تحذيرات
                  </button>
                  <button
                    onClick={() => setLogFilter('ERROR')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-sans ${
                      logFilter === 'ERROR' ? 'bg-rose-600 text-white font-bold' : 'bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    أخطاء
                  </button>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="بحث في السجلات..."
                    value={searchLog}
                    onChange={(e) => setSearchLog(e.target.value)}
                    className="pr-8 pl-3 py-1.5 text-xs border border-neutral-300 rounded-lg text-right font-sans"
                  />
                </div>
              </div>

              <div className="max-h-[50vh] overflow-y-auto space-y-1.5 p-2 bg-neutral-950 text-neutral-200 rounded-xl">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((ev, idx) => (
                    <div key={idx} className="p-2 border-b border-neutral-800/80 last:border-0 hover:bg-neutral-900/60 rounded">
                      <div className="flex items-center justify-between text-[10px] text-neutral-400">
                        <span>{ev.timestamp.split('T')[1]?.replace('Z', '')}</span>
                        <span
                          className={`font-bold ${
                            ev.level === 'CRITICAL' || ev.level === 'ERROR'
                              ? 'text-rose-400'
                              : ev.level === 'WARNING'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          [{ev.level}] {ev.component}.{ev.operation}
                        </span>
                      </div>
                      <div className="text-neutral-100 mt-0.5">{ev.message}</div>
                      {ev.analysis_id && (
                        <div className="text-[10px] text-neutral-500 mt-0.5">ID: {ev.analysis_id}</div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-neutral-500">لا توجد سجلات تطابق الفلتر المختار</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
