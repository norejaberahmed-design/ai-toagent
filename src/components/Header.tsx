import React from 'react';
import { RefreshCw, Plus, CheckCircle2, AlertTriangle, ShieldCheck, ChevronDown } from 'lucide-react';

interface HeaderProps {
  companyName: string;
  isComplete: boolean;
  lastReadTimestamp: string;
  isAnalyzing: boolean;
  onRefresh: () => void;
  onOpenConnectModal: () => void;
  onSwitchCompany: (tenantId: string) => void;
  currentTenantId: string;
}

export const Header: React.FC<HeaderProps> = ({
  companyName,
  isComplete,
  lastReadTimestamp,
  isAnalyzing,
  onRefresh,
  onOpenConnectModal,
  onSwitchCompany,
  currentTenantId,
}) => {
  return (
    <header className="border-b border-neutral-200 bg-white/95 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Brand & Subtitle */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <ShieldCheck className="w-5 h-5 text-neutral-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-neutral-900 font-serif">
                  مستشار ذكاء الشركة
                </h1>
                <span className="text-neutral-300 font-light">|</span>
                <span className="text-xs font-medium text-neutral-500">
                  صورة الشركة التنفيذية
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-medium">
                الحقيقة قبل الذكاء · مستند بالكامل إلى البيانات الفعلية
              </p>
            </div>
          </div>

          {/* Company Status, Freshness & Controls */}
          <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
            
            {/* Company Selector */}
            <div className="relative inline-flex items-center text-sm font-medium text-neutral-700 bg-neutral-100/80 rounded-md px-3 py-1.5 border border-neutral-200/80">
              <span className="text-xs text-neutral-500 ml-1.5">الشركة:</span>
              <select
                value={currentTenantId}
                onChange={(e) => onSwitchCompany(e.target.value)}
                className="bg-transparent text-neutral-900 font-semibold text-xs sm:text-sm focus:outline-none cursor-pointer pr-1"
              >
                <option value="tenant_riyadh_enterprise">شركة أسواق الرياض الكبرى</option>
                <option value="tenant_jeddah_trading">مؤسسة تجارة جدة المحدودة</option>
              </select>
            </div>

            {/* Data Completeness Status (Zero-Pill: Clean unboxed text) */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-600 px-2 py-1">
              {isComplete ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-medium text-emerald-800">بيانات متكاملة</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-medium text-amber-800">بيانات جزئية</span>
                </>
              )}
              <span className="text-neutral-300">·</span>
              <span className="text-neutral-500">آخر قراءة: {lastReadTimestamp}</span>
            </div>

            {/* Refresh / Re-analyze Button */}
            <button
              onClick={onRefresh}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-800 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-md px-3 py-1.5 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              title="إعادة فحص واكتشاف البيانات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin text-neutral-500' : 'text-neutral-600'}`} />
              <span>{isAnalyzing ? 'جارٍ الفحص...' : 'تحديث البيانات'}</span>
            </button>

            {/* Add / Connect Source Button */}
            <button
              onClick={onOpenConnectModal}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-md px-3.5 py-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ربط مصدر</span>
            </button>

          </div>
        </div>
      </div>
    </header>
  );
};
