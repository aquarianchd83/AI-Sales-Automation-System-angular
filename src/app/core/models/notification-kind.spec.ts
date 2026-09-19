import { TenantNotificationKind, isUrgentNotification } from './billing.model';

describe('plan expiry notifications', () => {
  it('match the values the API sends', () => {
    expect(TenantNotificationKind.PlanExpiring7).toBe(8);
    expect(TenantNotificationKind.PlanExpiring1).toBe(9);
  });

  it('are a heads-up a week out and urgent the day before', () => {
    expect(isUrgentNotification(TenantNotificationKind.PlanExpiring7)).toBeFalse();
    expect(isUrgentNotification(TenantNotificationKind.PlanExpiring1)).toBeTrue();
  });
});
