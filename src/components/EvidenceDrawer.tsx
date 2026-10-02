import React, { useState } from 'react';
import { X, ShieldCheck, ChevronDown, ChevronUp, CheckCircle2, Info } from 'lucide-react';

export interface EvidenceDrawerItem {
  title: string;
  metricLabel: string;
  value: string | number | null;
  currency?: string;
  period?: string;
  source: string;
  readTime: string;
  isComplete: boolean;
  statusMessage?: string;
  evidenceItems?: string[];
  advancedDetails?: {
    auditId?: string;
    sqlQuery?: string;
    sourceTable?: string;
    transformationChain?: string[];
  };
}

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: EvidenceDrawerItem | null;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" dir="rtl">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 left-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-white border-r border-neutral-200 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-neutral-100" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 leading-tight">سجل الإثبات المحاسبي</h3>
                <p className="text-[11px] text-neutral-500">توثيق مباشر من واقع سجلات الشركة المعتمدة</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Metric Title & Value Banner */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-2">
              <div className="text-xs text-neutral-500 font-medium">{data.metricLabel}</div>
              <div className="text-2xl font-extrabold text-neutral-900">
                {data.value !== null && data.value !== undefined ? (
                  <span>
                    {typeof data.value === 'number' ? data.value.toLocaleString('ar-SA') : data.value}
                    {data.currency ? ` ${data.currency}` : ''}
                  </span>
                ) : (
                  <span className="text-neutral-400 text-lg font-bold">غير متوفر</span>
                )}
              </div>
              {data.statusMessage && (
                <div className="text-xs text-neutral-600 pt-1 border-t border-neutral-200/60">
                  {data.statusMessage}
                </div>
              )}
            </div>

            {/* Core Verification Facts (Zero-Pill Minimal Metadata) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                بيانات التوثيق المالي
              </h4>
              <div className="divide-y divide-neutral-100 text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-neutral-500">المصدر المعتمد</span>
                  <span className="font-semibold text-neutral-900 text-left dir-ltr truncate max-w-[200px]" title={data.source}>
                    {data.source || 'غير محدد'}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-neutral-500">الفترة المسجلة</span>
                  <span className="font-semibold text-neutral-900">{data.period || 'الفترة الكاملة في السجلات'}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-neutral-500">العملة الأساسية</span>
                  <span className="font-semibold text-neutral-900">{data.currency || 'ريال'}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-neutral-500">وقت القراءة الفعلي</span>
                  <span className="font-semibold text-neutral-900">{data.readTime || 'عند فحص المصدر'}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-neutral-500">حالة الاكتمال</span>
                  <div className="flex items-center gap-1.5">
                    {data.isComplete ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-semibold text-neutral-900">مكتمل ومثبت</span>
                      </>
                    ) : (
                      <>
                        <Info className="w-3.5 h-3.5 text-amber-600" />
                        <span className="font-semibold text-amber-800">بيانات جزئية</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Evidence items if present */}
            {data.evidenceItems && data.evidenceItems.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <h4 className="text-xs font-bold text-neutral-900">سجلات الإثبات والوقائع</h4>
                <ul className="space-y-1.5 text-xs text-neutral-700 bg-neutral-50/70 border border-neutral-200/80 rounded-xl p-3 pr-4 border-r-2 border-r-neutral-800">
                  {data.evidenceItems.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Collapsible Advanced Technical Details (Audit Hash / Query) */}
            {data.advancedDetails && (
              <div className="pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full py-2 flex items-center justify-between text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  <span>تفاصيل متقدمة (للمدقق المحاسبي)</span>
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="mt-2.5 p-3.5 bg-neutral-900 text-neutral-200 rounded-xl text-[11px] font-mono space-y-2.5">
                    {data.advancedDetails.auditId && (
                      <div>
                        <span className="text-neutral-400 block text-[10px] font-sans">معرف الإثبات (Audit ID):</span>
                        <span className="text-neutral-100 select-all">{data.advancedDetails.auditId}</span>
                      </div>
                    )}

                    {data.advancedDetails.sourceTable && (
                      <div>
                        <span className="text-neutral-400 block text-[10px] font-sans">الجدول المصدر:</span>
                        <span className="text-neutral-100">{data.advancedDetails.sourceTable}</span>
                      </div>
                    )}

                    {data.advancedDetails.sqlQuery && (
                      <div>
                        <span className="text-neutral-400 block text-[10px] font-sans">الاستعلام المنفذ (القراءة فقط):</span>
                        <div className="bg-neutral-950 p-2 rounded border border-neutral-800 text-neutral-300 text-[10px] whitespace-pre-wrap break-all dir-ltr text-left">
                          {data.advancedDetails.sqlQuery}
                        </div>
                      </div>
                    )}

                    <div className="pt-1 text-[10px] text-neutral-400 font-sans border-t border-neutral-800">
                      محصن بنسبة 100% ضد التعديل • بدون استنتاج ذكاء اصطناعي
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-200 bg-neutral-50/50 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors shadow-xs"
            >
              إغلاق الدليل
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
