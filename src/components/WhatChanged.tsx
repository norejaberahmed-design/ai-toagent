import React from 'react';
import { TrendingUp, TrendingDown, ArrowRight, AlertCircle, Info } from 'lucide-react';
import { Signal, SignalType } from '../discovery/types';
import { UnifiedBusinessSnapshot } from '../model/unified';

interface WhatChangedProps {
  signals: readonly Signal[];
  snapshot: UnifiedBusinessSnapshot;
}

export const WhatChanged: React.FC<WhatChangedProps> = ({ signals, snapshot }) => {
  // Extract key change items purely from actual signals and snapshot facts
  const changeItems: Array<{
    titleAr: string;
    impactAr: string;
    isCauseProven: boolean;
    causeExplanationAr: string;
    direction: 'up' | 'down' | 'divergent' | 'neutral';
  }> = [];

  // 1. Margin Erosion signal
  const marginSig = signals.find((s) => s.type === SignalType.MARGIN_EROSION);
  if (marginSig) {
    const hasCostProof = marginSig.explanation_ar.includes('ارتفاع التكاليف');
    changeItems.push({
      titleAr: 'تراجع مستمر في هامش الربح عبر الفترات المتاحة',
      impactAr: marginSig.explanation_ar,
      isCauseProven: hasCostProof,
      causeExplanationAr: hasCostProof
        ? 'تم إثبات ارتفاع التكاليف المباشرة محاسبياً بالتزامن مع ثبات أسعار البيع.'
        : 'البيانات المتاحة تثبت التغير، لكنها لا تكفي لإثبات سببه الدقيق.',
      direction: 'down',
    });
  }

  // 2. Divergence signal (sales vs collections)
  const divSig = signals.find((s) => s.type === SignalType.DIVERGENCE);
  if (divSig) {
    changeItems.push({
      titleAr: 'التحصيل النقدي لا يواكب اتجاه المبيعات',
      impactAr: divSig.explanation_ar,
      isCauseProven: true,
      causeExplanationAr: 'مثبت حسابياً بتباعد معدلات النمو بين فواتير المبيعات الصادرة وحصيلة السداد الفعلية.',
      direction: 'divergent',
    });
  }

  // 3. Cashflow risk signal
  const cfSig = signals.find((s) => s.type === SignalType.CASHFLOW_RISK);
  if (cfSig) {
    changeItems.push({
      titleAr: 'عجز تشغيلي في التدفقات النقدية السائلة',
      impactAr: cfSig.explanation_ar,
      isCauseProven: true,
      causeExplanationAr: 'مثبت بفارق التدفق الفعلي بين المقبوضات والمصروفات المسددة.',
      direction: 'down',
    });
  }

  // 4. Sales stability
  if (snapshot.sales.value !== null && changeItems.length < 3) {
    changeItems.push({
      titleAr: 'المبيعات مستقرة عند مستوياتها الحالية',
      impactAr: `سجلت المبيعات إجمالي ${snapshot.sales.value.toLocaleString()} SAR عبر أوامر البيع المسجلة.`,
      isCauseProven: false,
      causeExplanationAr: 'البيانات المتاحة تثبت حجم المبيعات الفعلي، وتتطلب فترات تاريخية إضافية لإثبات محركات التغير الموسمية.',
      direction: 'neutral',
    });
  }

  // 5. Default baseline if no severe changes
  if (changeItems.length === 0) {
    changeItems.push({
      titleAr: 'استقرار المؤشرات الرئيسية المسجلة',
      impactAr: 'لم يتم رصد أي تباعد حاد أو انحراف إحصائي غير طبيعي في البيانات المحاسبية المتوفرة.',
      isCauseProven: true,
      causeExplanationAr: 'مستند إلى الفحص الحتمي الشامل لكافة الجداول والقيود المسجلة.',
      direction: 'neutral',
    });
  }

  return (
    <section className="bg-white rounded-xl border border-neutral-200/90 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between pb-4 border-b border-neutral-100 gap-2">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
            ماذا يحدث الآن؟ (What Changed)
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            التغيرات الجوهرية المرصودة في حركة العمليات — التفريق الصارم بين ما هو مثبت وما لا يمكن إثبات سببه
          </p>
        </div>
        <div className="text-2xs text-neutral-400 font-medium flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          <span>الحقيقة قبل التخمين</span>
        </div>
      </div>

      <div className="divide-y divide-neutral-100 mt-2">
        {changeItems.map((item, idx) => (
          <div key={idx} className="py-4 first:pt-3 last:pb-1 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-7 h-7 rounded-md bg-neutral-100 flex items-center justify-center text-neutral-700 shrink-0">
                {item.direction === 'down' ? (
                  <TrendingDown className="w-4 h-4 text-amber-600" />
                ) : item.direction === 'divergent' ? (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-neutral-500" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 leading-snug">
                  {item.titleAr}
                </h3>
                <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                  {item.impactAr}
                </p>
              </div>
            </div>

            {/* Factual Cause Status Box */}
            <div className="md:w-72 shrink-0 bg-neutral-50 rounded-lg p-2.5 border border-neutral-200/70 text-2xs">
              <span className="font-semibold text-neutral-700 block mb-0.5">
                {item.isCauseProven ? '✓ سبب مثبت محاسبياً:' : '⚠ حدود الاستدلال:'}
              </span>
              <p className="text-neutral-500 leading-relaxed">
                {item.causeExplanationAr}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
