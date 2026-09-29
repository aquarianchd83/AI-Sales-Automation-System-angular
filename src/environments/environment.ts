/**
 * Development environment.
 *
 * `apiBaseUrl` is relative so that `npm start` routes /api through proxy.conf.json
 * to the ASP.NET Core API (default https://localhost:7001). Change the target in
 * proxy.conf.json to match the port `dotnet run` prints, or set an absolute URL here.
 */
export const environment = {
  production: false,
  apiBaseUrl: '/api/v1',
  /** Refresh the access token this many seconds before it expires. */
  tokenRefreshLeewaySeconds: 60,
  /** SignalR notification bell channel - root-relative (not under apiBaseUrl), proxied by
   * proxy.conf.json's own "/hubs" entry in dev. */
  notificationsHubUrl: '/hubs/notifications',
};
