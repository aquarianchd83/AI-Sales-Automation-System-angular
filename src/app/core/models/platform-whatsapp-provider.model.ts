/** One selectable WhatsApp provider. `available` is false while its adapter is not built - shown, but cannot be chosen. */
export interface WhatsAppProviderOption {
  id: string;
  name: string;
  available: boolean;
  unavailableReason: string | null;
}

export interface WhatsAppProviderSettings {
  /** The provider every tenant's send/receive goes through: 'Meta' or 'QrBridge'. */
  active: string;
  providers: WhatsAppProviderOption[];
}
