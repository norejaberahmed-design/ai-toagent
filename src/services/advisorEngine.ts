import { CompanyMetrics } from './metricsEngine';
import { DataDiscoveryResult } from './discoveryEngine';

export interface AdvisorAnswer {
  summary: string;
  answerText: string;
  details?: string[];
  evidence: string[];
  isSupported: boolean;
  provenanceId?: string;
  metricValue?: string;
  category?: 'profit' | 'sales' | 'costs' | 'products' | 'customers' | 'inventory' | 'alerts' | 'unsupported';
}

export function queryCompanyAdvisor(
  question: string,
  metrics: CompanyMetrics | null,
  discovery: DataDiscoveryResult | null,
  currency: string = 'ريال'
): AdvisorAnswer {
  const q = question.trim().toLowerCase();

  // If source not connected or metrics unavailable
  if (!metrics || !discovery) {
    return {
      summary: 'البيانات بانتظار الربط.',
      answerText: 'لم يتم ربط بيانات الشركة بعد. يرجى ربط مصدر بيانات شركتك للبدء في التحليل وتلقي إجابات دقيقة مبنية على سجلاتك الفعلية دون أي تخمين.',
      evidence: ['مصدر البيانات غير متصل'],
      isSupported: false,
      category: 'unsupported',
    };
  }

  // 1. "ما أهم شيء يحتاج إلى انتباهي الآن؟" / "تنبيهات" / "أولويات"
  if (
    q.includes('انتباه') ||
    q.includes('أهم شيء') ||
    q.includes('اولويات') ||
    q.includes('أولويات') ||
    q.includes('خطر') ||
    q.includes('تحذير')
  ) {
    const alertsList: string[] = [];
    const lowStock = metrics.inventoryItems.filter((i) => i.status === 'critical' || i.status === 'low');
    if (lowStock.length > 0) {
      alertsList.push(`اقتراب نفاد مخزون ${lowStock.length} منتجات أساسية: ${lowStock.map((l) => `${l.name} (${l.stock})`).join('، ')}`);
    }

    if (metrics.topCustomers.length > 0 && metrics.totalSales) {
      const top1 = metrics.topCustomers[0];
      const ratio = (top1.totalSpent / metrics.totalSales) * 100;
      if (ratio > 25) {
        alertsList.push(`تركّز مالي: العميل «${top1.name}» يمثل وحده ${ratio.toFixed(1)}% من إجمالي مبيعات الشركة.`);
      }
    }

    if (metrics.slowMovingProducts.length > 0) {
      alertsList.push(`رصيد مخزون مجمد في ${metrics.slowMovingProducts.length} منتجات بحركة مبيعات بطيئة.`);
    }

    if (alertsList.length === 0) {
      return {
        summary: 'المؤشرات التشغيلية الحالية مستقرة ولا توجد نقاط حرجة.',
        answerText: 'استناداً للبيانات المعتمدة، لم يتم رصد أي مؤشرات حرجة في المخزون أو تركز المبيعات حالياً.',
        evidence: ['فحص المخزون والعملاء والمبيعات'],
        isSupported: true,
        category: 'alerts',
      };
    }

    return {
      summary: `أهم ما يحتاج انتباهك الآن: ${alertsList[0]}`,
      answerText: `بناءً على الفحص المباشر لسجلات شركتك، رصد النظام النقاط التالية ذات الأولوية الرقابية:`,
      details: alertsList,
      evidence: alertsList,
      isSupported: true,
      category: 'alerts',
    };
  }

  // 2. "ما وضع أرباحي؟" / "كم الربح؟" / "الأرباح" / "الهامش"
  if (
    q.includes('ربح') ||
    q.includes('الربح') ||
    q.includes('أرباح') ||
    q.includes('ارباح') ||
    q.includes('هامش') ||
    q.includes('وضع أرباحي') ||
    q.includes('أين أحقق')
  ) {
    if (!discovery.capabilities.profitSupported || metrics.grossProfit === null) {
      return {
        summary: 'لا يمكن حساب الربح بدقة لعدم توفر بيانات التكلفة في السجلات الحالية.',
        answerText: 'لا تتوفر بيانات تكلفة كافية لحساب الربح بدقة. يلتزم النظام بعدم افتراض أو تقدير أي أرباح دون وجود تكلفة شراء حقيقية في السجلات.',
        details: [
          'المطلوب لحساب الربح: ربط جدول أو حقل يوضح تكلفة شراء أو إنتاج المنتجات.',
          'السياسة المطبقة: حجب الأرباح التقديرية التزاماً بمبدأ الحقيقة قبل الذكاء.'
        ],
        evidence: ['غياب حقول التكلفة الفعلية (قاعدة الأمان المالي)'],
        isSupported: false,
        category: 'profit',
      };
    }

    const gross = metrics.grossProfit.toLocaleString('ar-SA');
    const margin = metrics.profitMarginPercent ? metrics.profitMarginPercent.toFixed(1) : '0';
    const net = metrics.netProfit !== null ? metrics.netProfit.toLocaleString('ar-SA') : gross;
    const prov = metrics.provenanceRecords.find((p) => p.metricKey === 'grossProfit');

    return {
      summary: `إجمالي الربح المحقق ${gross} ${currency} بهامش ربح ${margin}%.`,
      answerText: `وفقاً للتكاليف المسجلة، حققت الشركة إجمالي ربح قدره ${gross} ${currency}، وصافي ربح بعد خصم المصروفات المسجلة يبلغ ${net} ${currency}.`,
      details: [
        `إجمالي الإيرادات: ${metrics.totalSales?.toLocaleString('ar-SA')} ${currency}`,
        `إجمالي الربح: ${gross} ${currency} (هامش: ${margin}%)`,
        `صافي الربح بعد المصروفات: ${net} ${currency}`,
      ],
      evidence: [
        `إجمالي الربح: ${gross} ${currency}`,
        `هامش الربح: ${margin}%`,
        `صافي الربح: ${net} ${currency}`,
      ],
      isSupported: true,
      provenanceId: prov?.provenanceId,
      metricValue: `${gross} ${currency}`,
      category: 'profit',
    };
  }

  // 3. "أين ترتفع التكاليف؟" / "المصروفات" / "أين أخسر المال؟"
  if (
    q.includes('تكاليف') ||
    q.includes('التكاليف') ||
    q.includes('مصروف') ||
    q.includes('المصروفات') ||
    q.includes('أين أخسر') ||
    q.includes('أين تذهب') ||
    q.includes('نفقات')
  ) {
    if (!discovery.capabilities.expensesSupported || metrics.totalExpenses === null) {
      return {
        summary: 'لا توجد بيانات مصروفات تشغيلية مسجلة في المصدر الحالي.',
        answerText: 'لم يتم العثور على سجلات مصروفات أو بنود تشغيلية في قاعدة البيانات المربوطة حالياً.',
        evidence: ['جدول المصروفات غير مسجل'],
        isSupported: false,
        category: 'costs',
      };
    }

    const expStr = metrics.totalExpenses.toLocaleString('ar-SA');
    const prov = metrics.provenanceRecords.find((p) => p.metricKey === 'totalExpenses');

    return {
      summary: `إجمالي المصروفات المقيدة في السجلات يبلغ ${expStr} ${currency}.`,
      answerText: `تتركز التكاليف التشغيلية المقيدة في دفاتر الشركة بمبلغ إجمالي ${expStr} ${currency}.`,
      details: [
        `إجمالي المصروفات المقيدة: ${expStr} ${currency}`,
        metrics.totalSales
          ? `نسبة المصروفات إلى المبيعات: ${((metrics.totalExpenses / metrics.totalSales) * 100).toFixed(1)}%`
          : 'المبيعات غير محتسبة',
      ],
      evidence: [`إجمالي المصروفات: ${expStr} ${currency}`],
      isSupported: true,
      provenanceId: prov?.provenanceId,
      metricValue: `${expStr} ${currency}`,
      category: 'costs',
    };
  }

  // 4. "هل توجد منتجات مبيعاتها مرتفعة لكن ربحيتها منخفضة؟" / "فرص"
  if (
    q.includes('ربحيتها منخفضة') ||
    q.includes('مبيعاتها مرتفعة لكن') ||
    q.includes('فرص') ||
    q.includes('تحسين')
  ) {
    if (!discovery.capabilities.profitSupported) {
      return {
        summary: 'يتطلب تحديد ربحية المنتجات وجود بيانات التكلفة.',
        answerText: 'لا يمكن تقييم علاقة حجم المبيعات بهامش الربحية بدقة دون ربط بيانات تكلفة شراء المنتجات.',
        evidence: ['بيانات التكلفة غير مسجلة'],
        isSupported: false,
        category: 'products',
      };
    }

    return {
      summary: 'المنتجات الأكثر مبيعاً تحقق استقراراً في العائد، مع وجود فرص لتحسين هوامش الأصناف ذات الطلب المرتفع.',
      answerText: 'بناءً على مطابقة كميات المبيعات بالإيرادات، فإن الأصناف الأعلى إيراداً هي الركيزة الأساسية للسيولة.',
      details: metrics.topProducts.slice(0, 3).map((p) => `${p.name}: حقق إيراد ${p.totalRevenue.toLocaleString('ar-SA')} ${currency} ببيع ${p.soldQuantity} وحدة`),
      evidence: metrics.topProducts.slice(0, 2).map((p) => `${p.name}: ${p.totalRevenue.toLocaleString('ar-SA')} ${currency}`),
      isSupported: true,
      category: 'products',
    };
  }

  // 5. "ما المبالغ التي لم يتم تحصيلها؟" / "التحصيلات" / "الذمم"
  if (
    q.includes('تحصيل') ||
    q.includes('لم يتم تحصيلها') ||
    q.includes('الذمم') ||
    q.includes('مستحقات') ||
    q.includes('آجل')
  ) {
    if (metrics.paymentMethods.length > 0) {
      const summaryMethods = metrics.paymentMethods.map((m) => `${m.method}: ${m.totalAmount.toLocaleString('ar-SA')} ${currency} (${m.percentage.toFixed(1)}%)`).join('، ');
      return {
        summary: `جميع المعاملات المسجلة تم تسويتها عبر قنوات الدفع: ${metrics.paymentMethods.map((m) => m.method).join('، ')}.`,
        answerText: `بناءً على سجلات الفواتير المعتمدة، فإن توزيع المبالغ بحسب طريقة الدفع هو كالتالي:`,
        details: metrics.paymentMethods.map((m) => `${m.method}: ${m.totalAmount.toLocaleString('ar-SA')} ${currency} (${m.percentage.toFixed(1)}% من المبيعات)`),
        evidence: [summaryMethods],
        isSupported: true,
        category: 'sales',
      };
    }

    return {
      summary: 'لا توجد سجلات ذمم مدينة أو فواتير آجلة منفصلة في البيانات الحالية.',
      answerText: 'لا تتوفر في المصدر المربوط حالياً حقول خاصة بالفواتير غير المحصلة أو الذمم المدينة.',
      evidence: ['غياب جدول الذمم المستحقة'],
      isSupported: false,
      category: 'sales',
    };
  }

  // 6. Sales Questions: "كم بلغت مبيعاتي؟"
  if (
    q.includes('مبيعات') ||
    q.includes('المبيعات') ||
    q.includes('كم بلغت') ||
    q.includes('الإيراد') ||
    q.includes('ايرادات') ||
    q.includes('دخل')
  ) {
    if (!discovery.capabilities.salesSupported || metrics.totalSales === null) {
      return {
        summary: 'لا تتوفر بيانات مبيعات في المصدر الحالي.',
        answerText: 'لا تتوفر بيانات مبيعات كافية في السجلات الحالية للشركة.',
        evidence: ['غياب سجلات المبيعات أو الفواتير'],
        isSupported: false,
        category: 'sales',
      };
    }

    const prov = metrics.provenanceRecords.find((p) => p.metricKey === 'totalSales');
    const formatted = metrics.totalSales.toLocaleString('ar-SA');
    const avg = metrics.averageTransaction ? metrics.averageTransaction.toLocaleString('ar-SA', { maximumFractionDigits: 1 }) : '0';

    return {
      summary: `إجمالي مبيعات الشركة ${formatted} ${currency} عبر ${metrics.transactionCount} معاملة بيع.`,
      answerText: `وفقاً لسجلات المبيعات المعتمدة، بلغ إجمالي المبيعات ${formatted} ${currency}، من خلال ${metrics.transactionCount} معاملة بيع مكتملة، بمتوسط ${avg} ${currency} لكل معاملة.`,
      details: [
        `إجمالي المبيعات المعتمدة: ${formatted} ${currency}`,
        `عدد الفواتير المنفذة: ${metrics.transactionCount} فاتورة`,
        `متوسط قيمة الفاتورة الواحدة: ${avg} ${currency}`,
      ],
      evidence: [
        `إجمالي المبيعات: ${formatted} ${currency}`,
        `عدد المعاملات: ${metrics.transactionCount}`,
        `متوسط المعاملة: ${avg} ${currency}`,
      ],
      isSupported: true,
      provenanceId: prov?.provenanceId,
      metricValue: `${formatted} ${currency}`,
      category: 'sales',
    };
  }

  // 7. Top Products Questions: "ما المنتجات الأعلى مبيعًا؟"
  if (
    q.includes('أكثر') ||
    q.includes('الأكثر') ||
    q.includes('الاعلى') ||
    q.includes('الأعلى مبيع') ||
    q.includes('افضل') ||
    q.includes('أفضل') ||
    q.includes('مبيع') ||
    q.includes('منتجات مبيع')
  ) {
    if (!discovery.capabilities.productsSupported || metrics.topProducts.length === 0) {
      return {
        summary: 'لا تتوفر تفاصيل مبيعات المنتجات في المصدر الحالي.',
        answerText: 'لا تتوفر بيانات كافية عن تفاصيل مبيعات المنتجات في المصدر الحالي.',
        evidence: ['سجلات المنتجات أو بنود الفواتير غير مكتملة'],
        isSupported: false,
        category: 'products',
      };
    }

    const topList = metrics.topProducts.slice(0, 3);
    const topLeader = topList[0];

    return {
      summary: `المنتج الأكثر مبيعاً هو «${topLeader.name}» بإيراد ${topLeader.totalRevenue.toLocaleString('ar-SA')} ${currency}.`,
      answerText: `استناداً للبيانات المعتمدة، فإن المنتجات الأعلى تحقيقاً للإيرادات هي:`,
      details: topList.map((p, idx) => `${idx + 1}. ${p.name}: إيراد ${p.totalRevenue.toLocaleString('ar-SA')} ${currency} (بيع ${p.soldQuantity} وحدة)`),
      evidence: topList.map((p) => `${p.name}: ${p.totalRevenue.toLocaleString('ar-SA')} ${currency}`),
      isSupported: true,
      category: 'products',
    };
  }

  // 8. Slow Moving Products: "ما المنتجات الأقل حركة؟"
  if (
    q.includes('أقل') ||
    q.includes('الأقل حركة') ||
    q.includes('راكد') ||
    q.includes('بطيئة') ||
    q.includes('بطء') ||
    q.includes('اقل')
  ) {
    if (metrics.slowMovingProducts.length === 0) {
      return {
        summary: 'لا توجد بيانات كافية لتحديد المنتجات الأقل حركة.',
        answerText: 'لا توجد بيانات كافية لتحديد المنتجات الأقل حركة.',
        evidence: ['لا توجد سجلات كافية لحركة المخزون'],
        isSupported: false,
        category: 'products',
      };
    }

    const slowList = metrics.slowMovingProducts.slice(0, 3);
    const slowLeader = slowList[0];

    return {
      summary: `المنتج الأقل حركة هو «${slowLeader.name}» (بيع ${slowLeader.soldQuantity} وحدات مقابل مخزون ${slowLeader.stock}).`,
      answerText: `بناءً على حركة المبيعات الفعلية، فإن المنتجات الأقل حركة مع وجود مخزون بالمستودع هي:`,
      details: slowList.map((p, idx) => `${idx + 1}. ${p.name}: بيع ${p.soldQuantity} وحدات فقط مقابل مخزون ${p.stock} وحدة`),
      evidence: slowList.map((p) => `${p.name}: ${p.soldQuantity} مبيعات / ${p.stock} رصيد`),
      isSupported: true,
      category: 'products',
    };
  }

  // 9. Customers Questions: "من أكبر العملاء؟"
  if (
    q.includes('عميل') ||
    q.includes('العملاء') ||
    q.includes('زبائن') ||
    q.includes('من اشترى') ||
    q.includes('شراء')
  ) {
    if (!discovery.capabilities.customersSupported || metrics.topCustomers.length === 0) {
      return {
        summary: 'لا تتوفر سجلات عملاء مسماة في قاعدة البيانات.',
        answerText: 'لا تتوفر سجلات عملاء مسماة في قاعدة البيانات الحالية.',
        evidence: ['جدول العملاء غير متاح أو لا يحتوي على معرفات'],
        isSupported: false,
        category: 'customers',
      };
    }

    const cList = metrics.topCustomers.slice(0, 3);
    const topC = cList[0];

    return {
      summary: `أكبر عميل للشركة هو «${topC.name}» بإجمالي مشتريات ${topC.totalSpent.toLocaleString('ar-SA')} ${currency}.`,
      answerText: `أكبر العملاء شراءً في شركتك استناداً للفواتير المسجلة هم:`,
      details: cList.map((c, idx) => `${idx + 1}. ${c.name}: مشتريات ${c.totalSpent.toLocaleString('ar-SA')} ${currency} عبر ${c.orderCount} طلبات`),
      evidence: cList.map((c) => `${c.name}: ${c.totalSpent.toLocaleString('ar-SA')} ${currency}`),
      isSupported: true,
      category: 'customers',
    };
  }

  // 10. Inventory Questions: "ما وضع المخزون؟"
  if (
    q.includes('مخزون') ||
    q.includes('المخزون') ||
    q.includes('كميات') ||
    q.includes('المستودع')
  ) {
    if (!discovery.capabilities.inventorySupported || metrics.inventoryItems.length === 0) {
      return {
        summary: 'لا تتوفر بيانات كميات المخزون في السجلات الحالية.',
        answerText: 'لا تتوفر بيانات كميات المخزون في السجلات الحالية.',
        evidence: ['سجلات المخزون غير متاحة'],
        isSupported: false,
        category: 'inventory',
      };
    }

    const lowStock = metrics.inventoryItems.filter((i) => i.status === 'critical' || i.status === 'low');
    if (lowStock.length > 0) {
      return {
        summary: `يوجد ${lowStock.length} منتجات تقترب كمياتها من النفاد وتتطلب إعادة طلب.`,
        answerText: `استناداً للرصيد المسجل في المستودع، فإن الأصناف الحرجة هي:`,
        details: lowStock.map((i) => `${i.name}: المتبقي ${i.stock} وحدات`),
        evidence: lowStock.map((i) => `${i.name}: ${i.stock}`),
        isSupported: true,
        category: 'inventory',
      };
    }

    return {
      summary: 'حالة المخزون لجميع المنتجات مستقرة ولا توجد كميات حرجة.',
      answerText: `جميع المنتجات المراقبة (${metrics.inventoryItems.length} صنف) في مستويات آمنة.`,
      evidence: [`إجمالي المنتجات المراقبة: ${metrics.inventoryItems.length}`],
      isSupported: true,
      category: 'inventory',
    };
  }

  // 11. General / Unsupported Questions -> Strict No-Hallucination Policy
  return {
    summary: 'لا تتوفر بيانات كافية في سجلات الشركة للإجابة عن هذا السؤال.',
    answerText: 'لا تتوفر بيانات كافية في سجلات الشركة للإجابة عن هذا السؤال. يلتزم مستشار الشركة بمبدأ «الحقيقة قبل الذكاء» ولا يقدم أي معلومات غير مثبتة في بياناتك الرسمية.',
    evidence: ['السؤال يتناول معلومات غير مقيدة في قاعدة بيانات الشركة'],
    isSupported: false,
    category: 'unsupported',
  };
}
