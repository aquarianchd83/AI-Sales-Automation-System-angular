import { CATEGORIES_WITH_OWN_SCREEN } from './settings.model';

describe('CATEGORIES_WITH_OWN_SCREEN', () => {
  it('keeps the Integrations settings off the General page, since they are set on the Integrations page', () => {
    expect(CATEGORIES_WITH_OWN_SCREEN).toContain('Integrations');
  });

  it('keeps the WhatsApp provider and the QR bridge off the General page, since the WhatsApp Provider screen sets them', () => {
    expect(CATEGORIES_WITH_OWN_SCREEN).toContain('WhatsAppProvider');
    expect(CATEGORIES_WITH_OWN_SCREEN).toContain('WhatsAppBridge');
  });
});
