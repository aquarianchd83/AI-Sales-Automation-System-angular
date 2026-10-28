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

/** The platform's QR-bridge connection. The API key never comes back: only whether one is stored and its last four characters. */
export interface WhatsAppBridgeSettings {
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  webhookBaseUrl: string;
  /** While non-empty, only these tenants use the bridge when it is the active provider. Empty: every tenant. */
  pilotTenantIds: string[];
  isConfigured: boolean;
}

/** apiKey: null keeps the stored key, '' clears it, text replaces it. */
export interface UpdateWhatsAppBridgeSettingsRequest {
  baseUrl: string;
  apiKey: string | null;
  webhookBaseUrl: string;
  pilotTenantIds: string[];
}

export type BridgeStatus =
  | 'NotConnected'
  | 'ConnectionInitiated'
  | 'QrCodeAvailable'
  | 'AwaitingAuthentication'
  | 'Connected'
  | 'Disconnected'
  | 'Reconnecting'
  | 'ConnectionFailed'
  | 'Disabled';

/** One tenant's QR channel. `qrBase64` is temporary authentication material: shown, never stored. */
export interface WhatsAppChannelStatus {
  status: BridgeStatus;
  connectedPhone: string | null;
  lastError: string | null;
  statusUpdatedAtUtc: string | null;
  qrBase64: string | null;
  qrRefreshSeconds: number | null;
  /** False when a disconnect was requested but the bridge still reports the session open. */
  confirmed: boolean;
}

/** One tenant's provider: its own choice (null: follows the platform default), what it really uses, and the platform default. */
export interface TenantWhatsAppProvider {
  override: string | null;
  effective: string;
  platformDefault: string;
}
