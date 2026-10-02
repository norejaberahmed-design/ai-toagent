import React from 'react';
import { Eye, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { ProvenancedValue } from '../connectors/types';
import { UnifiedBusinessSnapshot } from '../model/unified';

interface MetricItem {
  key: string;
  labelAr: string;
  value: ProvenancedValue<number>;
  format: 'currency' | 'percent' | 'count';
  descriptionAr: string;
}

interface CompanyPulseProps {
  snapshot: UnifiedBusinessSnapshot;
  onOpenEvidence: (title: string, value: ProvenancedValue<number>) => void;
}

export const CompanyPulse: React.FC<CompanyPulseProps> = ({ snapshot, onOpenEvidence }) => {
  const pulseMetrics: MetricItem[] = [
    {
      key: 'revenue',
      labelAr: 'الإيرادات',
      value: snapshot.revenue,
      format: 'currency',
      descriptionAr: 'إجمالي العوائد المحققة من المبيعات والخدمات',
    },
    {
      key: 'sales',
      labelAr: 'المبيعات',
      value: snapshot.sales,
      format: 'currency',
      descriptionAr: 'إجمالي قيمة فواتير المبيعات الصادرة',
    },
    {
      key: 'profit',
      labelAr: 'إجمالي الربح',
      value: snapshot.profit,
      format: 'currency',
      descriptionAr: 'فارق المبيعات عن التكلفة المباشرة للبضاعة المباعة',
    },
    {
      key: 'margin',
      labelAr: 'هامش الربح',
      value: snapshot.margin,
      format: 'percent',
      descriptionAr: 'نسبة مجمل الربح إلى إجمالي المبيعات',
    },
    {
      key: 'expense',
      labelAr: 'المصروفات التشغيلية',
      value: snapshot.expense,
      format: 'currency',
      descriptionAr: 'تكاليف الإيجار والمرافق والتشغيل اليومي',
    },
    {
      key: 'collection',
      labelAr: 'التحصيل الفعلي',
      value: snapshot.collection,
      format: 'currency',
      descriptionAr: 'المبالغ النقدية والمصرفية المسددة فعلياً',
    },
    {
      key: 'receivable',
      labelAr: 'الذمم المدينة',
      value: snapshot.receivable,
      format: 'currency',
      descriptionAr: 'مستحقات المبيعات المعلقة وغير المحصلة',
    },
    {
      key: 'inventory',
      labelAr: 'المخزون السلعي',
      value: snapshot.inventory,
      format: 'count',
      descriptionAr: 'كميات البضاعة المتاحة في المستودعات',
    },
    {
      key: 'cashflow',
      labelAr: 'التدفق النقدي التشغيلي',
      value: snapshot.cashflow,
      format: 'currency',
      descriptionAr: 'الفرق الفعلي بين التحصيلات والمصروفات المسددة',
    },
  ];

  const formatDisplayValue = (val: number | null, format: 'currency' | 'percent' | 'count', currency: string) => {
    if (val === null || val === undefined) {
      return 'غير متوفر';
    }
    if (format === 'percent') {
      return `${Math.round(val * 100)}%`;
    }
    if (format === 'count') {
      return `${val.toLocaleString()} وحدة`;
    }
    return `${val.toLocaleString()} ${currency}`;
  };

  return (
    <section className="bg-white rounded-xl border border-neutral-200/90 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between pb-4 border-b border-neutral-100 gap-2">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
            نبض الشركة (Company Pulse)
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            المؤشرات المالية والتشغيلية المتاحة — كل رقم مدعوم بدليل محاسبي يمكن فحصه بالكامل
          </p>
        </div>
        <span className="text-xs text-neutral-400 font-medium">
          الفترة: {snapshot.period ? `${snapshot.period.from} إلى ${snapshot.period.to}` : 'الفترة الحالية'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
        {pulseMetrics.map((metric) => {
          const isAvailable = metric.value.value !== null && metric.value.value !== undefined;
          const isComplete = isAvailable && metric.value.is_complete;
          const displayVal = formatDisplayValue(metric.value.value, metric.format, metric.value.currency || 'SAR');

          return (
            <div
              key={metric.key}
              className={`rounded-lg border p-4 flex flex-col justify-between transition-colors ${
                isAvailable ? 'bg-white border-neutral-200/90 hover:border-neutral-300' : 'bg-neutral-50/50 border-dashed border-neutral-200 text-neutral-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-600 block">
                    {metric.labelAr}
                  </span>
                  {isAvailable && (
                    <span className="text-2xs text-neutral-400 flex items-center gap-1">
                      {isComplete ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-amber-500 inline" />
                      )}
                      <span>{isComplete ? 'مكتمل' : 'جزئي'}</span>
                    </span>
                  )}
                </div>

                <div className="mt-2.5">
                  <div
                    className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${
                      isAvailable ? 'text-neutral-900' : 'text-neutral-400 font-sans text-base'
                    }`}
                  >
                    {displayVal}
                  </div>
                  <p className="text-2xs text-neutral-500 mt-1 leading-relaxed">
                    {metric.descriptionAr}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-2xs">
                <span className="text-neutral-400">
                  {metric.value.period ? `${metric.value.period.from} · ${metric.value.currency || 'SAR'}` : 'الفترة الحالية'}
                </span>
                {isAvailable ? (
                  <button
                    onClick={() => onOpenEvidence(metric.labelAr, metric.value)}
                    className="inline-flex items-center gap-1 text-neutral-700 hover:text-neutral-950 font-medium transition-colors cursor-pointer group"
                  >
                    <Eye className="w-3 h-3 text-neutral-400 group-hover:text-neutral-900" />
                    <span>عرض الدليل</span>
                  </button>
                ) : (
                  <span className="text-neutral-400 italic">غير متوفر بالمصدر</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
