import React from 'react';
import { AlertCircle, AlertTriangle, Info, Lightbulb, Eye, Clock } from 'lucide-react';
import { DiscoveryValue, Severity, Signal } from '../discovery/types';

interface WhatNeedsAttentionProps {
  signals: readonly Signal[];
  onOpenSignalEvidence: (signal: Signal) => void;
}

export const WhatNeedsAttention: React.FC<WhatNeedsAttentionProps> = ({
  signals,
  onOpenSignalEvidence,
}) => {
  const getSeverityStyle = (severity: Severity) => {
    switch (severity) {
      case Severity.CRITICAL:
        return {
          icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />,
          badgeColor: 'text-rose-700 bg-rose-50 border-rose-200/80',
          cardBorder: 'border-rose-200/80 hover:border-rose-300',
          dot: '🔴',
          labelAr: 'حرج',
        };
      case Severity.WARNING:
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
          badgeColor: 'text-amber-800 bg-amber-50 border-amber-200/80',
          cardBorder: 'border-amber-200/70 hover:border-amber-300',
          dot: '🟠',
          labelAr: 'تحذير',
        };
      case Severity.OPPORTUNITY:
        return {
          icon: <Lightbulb className="w-4 h-4 text-emerald-600 shrink-0" />,
          badgeColor: 'text-emerald-800 bg-emerald-50 border-emerald-200/80',
          cardBorder: 'border-emerald-200/70 hover:border-emerald-300',
          dot: '💡',
          labelAr: 'فرصة',
        };
      case Severity.INFO:
      default:
        return {
          icon: <Info className="w-4 h-4 text-sky-600 shrink-0" />,
          badgeColor: 'text-sky-800 bg-sky-50 border-sky-200/80',
          cardBorder: 'border-neutral-200/80 hover:border-neutral-300',
          dot: 'ℹ️',
          labelAr: 'معلومات',
        };
    }
  };

  const getEvidencePeriod = (evidence: readonly DiscoveryValue<unknown>[]) => {
    if (evidence.length === 0) return 'الفترة الحالية';
    const firstPeriod = evidence[0].period;
    if (!firstPeriod) return 'الفترة الحالية';
    if (evidence.length > 1) {
      const lastPeriod = evidence[evidence.length - 1].period;
      if (lastPeriod && lastPeriod.to !== firstPeriod.to) {
        return `${firstPeriod.from} إلى ${lastPeriod.to}`;
      }
    }
    return `${firstPeriod.from} إلى ${firstPeriod.to}`;
  };

  return (
    <section className="bg-white rounded-xl border border-neutral-200/90 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between pb-4 border-b border-neutral-100 gap-2">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
            ما يحتاج انتباهك (What Needs Attention)
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            إشارات حتمية صادرة من محرك الاستكشاف مرتبة وفق أولوية المخاطر التشغيلية والمالية
          </p>
        </div>
        <span className="text-xs text-neutral-400 font-medium">
          مرتبة تلقائياً بواسطة Priority Engine
        </span>
      </div>

      {signals.length === 0 ? (
        <div className="text-center py-10 text-neutral-400">
          <Info className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
          <p className="text-sm">لم يتم رصد أي إشارات حرجة أو تحذيرية في البيانات المتوفرة.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          {signals.map((signal) => {
            const style = getSeverityStyle(signal.severity);
            const periodStr = getEvidencePeriod(signal.evidence);

            return (
              <div
                key={signal.id}
                className={`rounded-lg border p-4.5 bg-white transition-all flex flex-col justify-between ${style.cardBorder}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                      <span>{style.dot}</span>
                      <span>{style.labelAr}</span>
                    </span>
                    <span className="text-2xs text-neutral-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-neutral-400" />
                      <span>{periodStr}</span>
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-neutral-900 leading-snug">
                    {signal.title_ar}
                  </h3>

                  <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                    {signal.explanation_ar}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-2xs">
                  <span className="text-neutral-400">
                    عدد الأدلة المحاسبية: {signal.evidence.length}
                  </span>
                  <button
                    onClick={() => onOpenSignalEvidence(signal)}
                    className="inline-flex items-center gap-1 text-neutral-700 hover:text-neutral-950 font-medium transition-colors cursor-pointer group"
                  >
                    <Eye className="w-3 h-3 text-neutral-400 group-hover:text-neutral-900" />
                    <span>عرض الدليل</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
