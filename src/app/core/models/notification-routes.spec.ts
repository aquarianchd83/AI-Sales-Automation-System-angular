import { TenantNotificationKind, isUrgentNotification, tenantNotificationRoute, NOTIFICATION_KIND_LABELS } from './billing.model';
import { PlatformNotificationKind, platformNotificationRoute } from './platform.model';

describe('notification routes', () => {
  it('sends a tenant notification to the screen where its subject is dealt with', () => {
    expect(tenantNotificationRoute(TenantNotificationKind.TemplateApproved)).toBe('/message-templates');
    expect(tenantNotificationRoute(TenantNotificationKind.TemplateNeedsAttention)).toBe('/message-templates');
    expect(tenantNotificationRoute(TenantNotificationKind.AccountLocked)).toBe('/audit-log');
    expect(tenantNotificationRoute(TenantNotificationKind.WhatsAppTokenFailing)).toBe('/tenant-settings');
    expect(tenantNotificationRoute(TenantNotificationKind.PlanRenewalFailed)).toBe('/billing');
    expect(tenantNotificationRoute(TenantNotificationKind.PlanExpiring7)).toBe('/billing');
    expect(tenantNotificationRoute(TenantNotificationKind.JobCompleted)).toBe('/tenant-settings/jobs');
    expect(tenantNotificationRoute(TenantNotificationKind.QuotaExhausted)).toBe('/billing/wallet');
    expect(tenantNotificationRoute(TenantNotificationKind.CreditsAdded)).toBe('/billing/wallet');
  });

  it('sends an operator alert to the refund queue, the tenant, or the jobs', () => {
    expect(platformNotificationRoute({ kind: 'RefundRequested', tenantId: 't1' })).toBe('/platform/refunds');
    expect(platformNotificationRoute({ kind: 'RefundFailed', tenantId: 't1' })).toBe('/platform/refunds');
    expect(platformNotificationRoute({ kind: 'TenantSignedUp', tenantId: 't1' })).toBe('/platform/tenants/t1');
    expect(platformNotificationRoute({ kind: 'PlanRenewalFailed', tenantId: 't1' })).toBe('/platform/tenants/t1');
    expect(platformNotificationRoute({ kind: 'TenantSignedUp', tenantId: null })).toBe('/platform/tenants');
    expect(platformNotificationRoute({ kind: 'JobFailing', tenantId: 't1' })).toBe('/platform/jobs');
    expect(platformNotificationRoute({ kind: 'JobRecovered', tenantId: null })).toBe('/platform/jobs');
  });

  it('every operator alert kind has a route (nothing falls through to a wrong screen by accident)', () => {
    const kinds: PlatformNotificationKind[] = ['JobFailing', 'JobRecovered', 'TenantSignedUp', 'RefundRequested', 'RefundFailed', 'PlanRenewalFailed'];
    for (const kind of kinds) {
      expect(platformNotificationRoute({ kind, tenantId: 't' })).toMatch(/^\/platform\//);
    }
  });

  it('the things a tenant must act on are drawn as urgent, and every kind has a label', () => {
    for (const kind of [TenantNotificationKind.TemplateNeedsAttention, TenantNotificationKind.PlanRenewalFailed, TenantNotificationKind.WhatsAppTokenFailing, TenantNotificationKind.AccountLocked]) {
      expect(isUrgentNotification(kind)).toBeTrue();
    }
    expect(isUrgentNotification(TenantNotificationKind.TemplateApproved)).toBeFalse();
    expect(isUrgentNotification(TenantNotificationKind.JobCompleted)).toBeFalse();
    expect(Object.keys(NOTIFICATION_KIND_LABELS).length).toBe(Object.values(TenantNotificationKind).filter((v) => typeof v === 'number').length);
  });
});
