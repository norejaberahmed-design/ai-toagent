import React, { useState } from 'react';
import { Layers, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Signal } from '../discovery/types';

interface WhatWasDiscoveredProps {
  signals: readonly Signal[];
  onOpenSignalEvidence: (signal: Signal) => void;
}

interface CategorySummary {
  key: string;
  labelAr: string;
  signals: Signal[];
}

export const WhatWasDiscovered: React.FC<WhatWasDiscoveredProps> = ({
  signals,
  onOpenSignalEvidence,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories: CategorySummary[] = [
    {
      key: 'profitability',
      labelAr: 'الربحية والهوامش',
      signals: signals.filter((s) => s.related_concepts.some((c) => c === 'profit' || c === 'sales')),
    },
    {
      key: 'sales',
      labelAr: 'المبيعات والإيرادات',
      signals: signals.filter((s) => s.related_concepts.some((c) => c === 'sales' || c === 'revenue')),
    },
    {
      key: 'collection',
      labelAr: 'التحصيل والذمم',
      signals: signals.filter((s) => s.related_concepts.some((c) => c === 'collection' || c === 'receivable')),
    },
    {
      key: 'liquidity',
      labelAr: 'السيولة والتدفق النقدي',
      signals: signals.filter((s) => s.related_concepts.some((c) => c === 'cashflow')),
    },
    {
      key: 'inventory',
      labelAr: 'المخزون والأصناف',
      signals: signals.filter((s) => s.related_concepts.some((c) => c === 'inventory' || c === 'product')),
    },
    {
      key: 'customers',
      labelAr: 'محفظة العملاء',
      signals: signals.filter((s) => s.related_concepts.some((c) => c === 'customer')),
    },
    {
      key: 'expenses',
      labelAr: 'المصروفات والتكاليف',
      signals: signals.filter((s) => s.related_concepts.some((c) => c === 'expense' || c === 'cost')),
    },
  ];

  const activeCategoryData = categories.find((c) => c.key === selectedCategory);

  return (
    <section className="bg-white rounded-xl border border-neutral-200/90 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between pb-4 border-b border-neutral-100 gap-2">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
            ماذا اكتشف المستشار؟ (What Was Discovered)
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            توزيع إشارات الاكتشاف الحتمية حسب المجالات التشغيلية والمالية الأساسية
          </p>
        </div>
        <span className="text-xs text-neutral-400 font-medium">
          إجمالي الإشارات المرصودة: {signals.length}
        </span>
      </div>

      {/* Category Pills/Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 mt-5">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.key;
          const count = cat.signals.length;

          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(isSelected ? null : cat.key)}
              className={`p-3 rounded-lg border text-right transition-all cursor-pointer ${
                isSelected
                  ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                  : 'bg-white border-neutral-200/80 hover:border-neutral-300 text-neutral-800'
              }`}
            >
              <span className={`text-2xs font-semibold block ${isSelected ? 'text-neutral-300' : 'text-neutral-500'}`}>
                {cat.labelAr}
              </span>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className={`text-lg font-bold font-mono ${isSelected ? 'text-white' : 'text-neutral-900'}`}>
                  {count}
                </span>
                <span className={`text-2xs ${isSelected ? 'text-neutral-400' : 'text-neutral-400'}`}>
                  {count === 1 ? 'إشارة' : count === 2 ? 'إشارتان' : count > 2 ? 'إشارات' : 'لا توجد'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Expanded Category Drawer */}
      {activeCategoryData && (
        <div className="mt-4 p-4 rounded-lg bg-neutral-50 border border-neutral-200/80 transition-all">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-200/60">
            <h3 className="text-xs font-bold text-neutral-900">
              تفاصيل إشارات: {activeCategoryData.labelAr} ({activeCategoryData.signals.length})
            </h3>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-2xs text-neutral-500 hover:text-neutral-800 underline cursor-pointer"
            >
              إغلاق التفاصيل
            </button>
          </div>

          {activeCategoryData.signals.length === 0 ? (
            <p className="text-xs text-neutral-500 py-2">
              لم تسجل أي إشارات تنبيه أو شذوذ ضمن فئة {activeCategoryData.labelAr} في البيانات الحالية.
            </p>
          ) : (
            <div className="space-y-2.5">
              {activeCategoryData.signals.map((sig) => (
                <div
                  key={sig.id}
                  className="bg-white p-3 rounded-md border border-neutral-200/80 flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-neutral-900 block mb-0.5">
                      {sig.title_ar}
                    </span>
                    <p className="text-neutral-600 leading-relaxed">
                      {sig.explanation_ar}
                    </p>
                  </div>
                  <button
                    onClick={() => onOpenSignalEvidence(sig)}
                    className="shrink-0 inline-flex items-center gap-1 text-2xs font-semibold text-neutral-700 hover:text-neutral-950 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 px-2 py-1 rounded cursor-pointer"
                  >
                    <Eye className="w-3 h-3 text-neutral-500" />
                    <span>الدليل</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
