export const environment = {
  production: true,
  apiBaseUrl: 'https://sellio.nayancare.com/api/v1',
  tokenRefreshLeewaySeconds: 60,
  notificationsHubUrl: 'https://sellio.nayancare.com/hubs/notifications',
  /** Product analytics. Leave an ID empty to keep that tool off entirely (no script is loaded). */
  analytics: {
    /** Google Analytics 4 Measurement ID, e.g. 'G-XXXXXXXXXX'. */
    gaMeasurementId: '',
    /** Microsoft Clarity project ID (Clarity > Settings > Overview). */
    clarityProjectId: '',
  },
};
