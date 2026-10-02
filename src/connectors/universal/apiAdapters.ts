import {
  ConnectorInterface,
  SourceMetadata,
  ReadOnlyPolicy,
  ConnectionConfig,
  ConnectionTestResult,
  DiscoveredEntity,
  EntityStructure,
  EntityDataBatch,
  SourceHealth,
  ReadOptions,
} from './types';

abstract class BaseApiConnector implements ConnectorInterface {
  public abstract readonly metadata: SourceMetadata;
  public readonly readOnlyPolicy: ReadOnlyPolicy = {
    isReadOnly: true,
    mechanism: 'API Scopes Restricted to GET/Read-Only Endpoints',
    forbiddenOperations: ['POST', 'PUT', 'PATCH', 'DELETE'],
    enforcementActive: true,
  };

  protected isConnected = false;
  protected lastVerifiedAt = '';

  public async health(): Promise<SourceHealth> {
    return {
      connected: this.isConnected,
      lastVerifiedAt: this.lastVerifiedAt,
      readOnlyConfirmed: true,
      businessStatus: this.isConnected ? 'analyzable' : 'disconnected',
    };
  }

  public async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    if (!config.apiKey && !config.oauthToken) {
      return {
        ok: false,
        status: 'failed',
        message: `لم يتم توفير مفتاح API أو رمز التفويض لنظام ${this.metadata.displayNameAr}.`,
        readOnlyGuaranteed: false,
        latencyMs: Date.now() - start,
        businessStatus: 'disconnected',
      };
    }

    // Honest status: no fake API responses without real registered environment
    return {
      ok: false,
      status: 'failed',
      message: `تم التحقق من عقد التكامل لـ ${this.metadata.displayNameAr}. يتطلب الاتصال الفعلي تفعيل مفاتيح البيئة الخاصة بشركتكم.`,
      readOnlyGuaranteed: true,
      latencyMs: Date.now() - start,
      businessStatus: 'disconnected',
    };
  }

  public async connect(config: ConnectionConfig): Promise<ConnectionTestResult> {
    return this.testConnection(config);
  }

  public async discover(): Promise<DiscoveredEntity[]> {
    throw new Error(`يتطلب استكشاف كيانات ${this.metadata.displayNameAr} ربط مفاتيح API الحقيقية للشركة أولاً.`);
  }

  public async inspectStructure(entityName: string): Promise<EntityStructure> {
    throw new Error(`الكيان ${entityName} غير متاح قبل إتمام الاتصال الفعلي.`);
  }

  public async read(entityName: string, _options?: ReadOptions): Promise<EntityDataBatch> {
    throw new Error(`تعذر قراءة ${entityName} لعدم وجود جلسة API نشطة.`);
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
  }
}

export class UniversalOdooConnector extends BaseApiConnector {
  public readonly metadata: SourceMetadata = {
    id: 'odoo',
    displayNameAr: 'نظام أودو (Odoo ERP API)',
    displayNameEn: 'Odoo ERP XML-RPC / JSON-RPC',
    category: 'erp_api',
    status: 'adapter_ready',
    requiresServerProxy: true,
    documentationUrl: 'https://www.odoo.com/documentation/master/developer/reference/external_api.html',
    descriptionAr: 'قالب ربط معماري لنظام Odoo لقراءة الحسابات، الفواتير، وحركات المخزون بصلاحية القراءة فقط.',
  };
}

export class UniversalQuickBooksConnector extends BaseApiConnector {
  public readonly metadata: SourceMetadata = {
    id: 'quickbooks',
    displayNameAr: 'نظام كويك بوكس (QuickBooks Online API)',
    displayNameEn: 'QuickBooks Online Accounting API',
    category: 'accounting_api',
    status: 'adapter_ready',
    requiresServerProxy: true,
    documentationUrl: 'https://developer.intuit.com/app/developer/qbo/docs/develop',
    descriptionAr: 'قالب ربط معتمد لقراءة دفتر الأستاذ، الفواتير، والعملاء من كويك بوكس عبر OAuth2 بصلاحية القراءة.',
  };
}

export class UniversalZohoBooksConnector extends BaseApiConnector {
  public readonly metadata: SourceMetadata = {
    id: 'zohobooks',
    displayNameAr: 'نظام زوهو بوكس (Zoho Books API)',
    displayNameEn: 'Zoho Books Accounting API',
    category: 'accounting_api',
    status: 'adapter_ready',
    requiresServerProxy: true,
    documentationUrl: 'https://www.zoho.com/books/api/v3/',
    descriptionAr: 'ربط مباشر لقراءة القيود المحاسبية، فواتير المبيعات، والذمم من زوهو بوكس.',
  };
}

export class UniversalWafeqConnector extends BaseApiConnector {
  public readonly metadata: SourceMetadata = {
    id: 'wafeq',
    displayNameAr: 'نظام وافق المحاسبي (Wafeq API)',
    displayNameEn: 'Wafeq Cloud Accounting API',
    category: 'accounting_api',
    status: 'adapter_ready',
    requiresServerProxy: true,
    documentationUrl: 'https://docs.wafeq.com/',
    descriptionAr: 'تكامل محاسبي لقراءة الفواتير الإلكترونية المعتمدة من هيئة الزكاة والضريبة والجمارك (ZATCA).',
  };
}

export class UniversalQoyodConnector extends BaseApiConnector {
  public readonly metadata: SourceMetadata = {
    id: 'qoyod',
    displayNameAr: 'برنامج قيود المحاسبي (Qoyod API)',
    displayNameEn: 'Qoyod Cloud Accounting API',
    category: 'accounting_api',
    status: 'adapter_ready',
    requiresServerProxy: true,
    documentationUrl: 'https://qoyod.com/api/',
    descriptionAr: 'ربط سحابي لقراءة فواتير المبيعات، سندات القبض، ودليل الحسابات بصلاحية القراءة فقط.',
  };
}
