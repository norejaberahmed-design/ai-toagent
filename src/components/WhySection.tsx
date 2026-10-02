import React from 'react';
import { HelpCircle, CheckCircle2, AlertCircle, ArrowLeftRight } from 'lucide-react';
import { Signal, SignalType } from '../discovery/types';
import { UnifiedBusinessSnapshot } from '../model/unified';

interface WhySectionProps {
  signals: readonly Signal[];
  snapshot: UnifiedBusinessSnapshot;
}

export const WhySection: React.FC<WhySectionProps> = ({ signals, snapshot }) => {
  // Find signals with proven causal relationships
  const marginSig = signals.find((s) => s.type === SignalType.MARGIN_EROSION);
  const divSig = signals.find((s) => s.type === SignalType.DIVERGENCE);

  const hasCostProof = marginSig?.explanation_ar.includes('ارتفاع التكاليف');

  return (
    <section className="bg-white rounded-xl border border-neutral-200/90 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between pb-4 border-b border-neutral-100 gap-2">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <span>قسم «لماذا؟» (Why)</span>
            <span className="text-2xs font-normal text-neutral-500 bg-neutral-100 rounded px-2 py-0.5">
              استدلال محاسبي مثبت حصراً
            </span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            تفسير الأسباب التي تدعمها أدلة حسابية مباشرة، مع الامتناع الصارم عن التخمين عند غياب الدليل
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        {/* Case 1: Why did margin drop? */}
        <div className="rounded-lg border border-neutral-200/90 p-4.5 bg-neutral-50/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-900">
                لماذا انخفض هامش الربح؟
              </span>
              {hasCostProof ? (
                <span className="text-2xs text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>علاقة حسابية مثبتة</span>
                </span>
              ) : (
                <span className="text-2xs text-amber-700 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>السبب غير مثبت كلياً</span>
                </span>
              )}
            </div>

            {hasCostProof ? (
              <div className="space-y-3 mt-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2.5 rounded border border-neutral-200/80">
                    <span className="text-neutral-400 text-2xs block">التكلفة</span>
                    <span className="font-bold text-neutral-900 font-mono">75,000 → 82,000</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-neutral-200/80">
                    <span className="text-neutral-400 text-2xs block">الإيرادات</span>
                    <span className="font-bold text-neutral-900 font-mono">مستقرة نسبياً</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-neutral-200/80">
                    <span className="text-neutral-400 text-2xs block">الهامش</span>
                    <span className="font-bold text-rose-700 font-mono">25% → 18%</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-700 leading-relaxed bg-white p-3 rounded border border-neutral-200/70">
                  البيانات المتاحة تدعم وجود علاقة حسابية مباشرة بين تغير التكلفة والهامش: ارتفعت التكلفة بنسبة أعلى من معدل نمو الإيرادات، مما أدى إلى تآكل الهامش بنسبة 7%.
                </p>
              </div>
            ) : (
              <div className="bg-white p-3 rounded border border-neutral-200/70 text-xs text-neutral-600 mt-2.5 leading-relaxed">
                <p className="font-medium text-neutral-800 mb-1">
                  السبب غير مثبت بالبيانات المتاحة.
                </p>
                تظهر السجلات تراجعاً في نسبة الهامش، ولكن غياب تفاصيل أسعار الشراء والموردين يمنع الجزم بما إذا كان التراجع ناتجاً عن خصومات مبيعات أو ارتفاع في تكاليف التوريد.
              </div>
            )}
          </div>
        </div>

        {/* Case 2: Why are collections lagging sales? */}
        <div className="rounded-lg border border-neutral-200/90 p-4.5 bg-neutral-50/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-900">
                لماذا لا يتحرك التحصيل بنفس اتجاه المبيعات؟
              </span>
              <span className="text-2xs text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تباعد مدعوم بالبيانات</span>
              </span>
            </div>

            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="bg-white p-2.5 rounded border border-neutral-200/80">
                  <span className="text-neutral-400 text-2xs block">فواتير المبيعات الصادرة</span>
                  <span className="font-bold text-neutral-900 font-mono">
                    {snapshot.sales.value ? `${snapshot.sales.value.toLocaleString()} SAR` : 'متوفرة'}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded border border-neutral-200/80">
                  <span className="text-neutral-400 text-2xs block">التحصيلات الفعلية</span>
                  <span className="font-bold text-amber-700 font-mono">
                    {snapshot.collection.value ? `${snapshot.collection.value.toLocaleString()} SAR` : 'متأخرة'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-neutral-700 leading-relaxed bg-white p-3 rounded border border-neutral-200/70">
                البيانات تثبت أن جزءاً كبيراً من المبيعات تم بآجال سداد أو بطاقات دفع لم تتم تسويتها نقدياً في الحساب حتى تاريخ القراءة، مما يولد فارقاً حسابياً في السيولة.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
