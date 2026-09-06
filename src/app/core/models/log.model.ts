/**
 * LogEntryDto.Level. Serilog's default text template writes the 3-letter code (e.g. "WRN") to the
 * file; LogService normalizes both that and the full name to these values on the way out, and
 * accepts either form on the way back in as a filter — these are the full names.
 */
export enum LogLevel {
  Verbose = 'Verbose',
  Debug = 'Debug',
  Information = 'Information',
  Warning = 'Warning',
  Error = 'Error',
  Fatal = 'Fatal',
}

/** Least-to-most severe — matches LogService's LevelCodeToName declaration order. */
export const LOG_LEVELS: LogLevel[] = [
  LogLevel.Verbose,
  LogLevel.Debug,
  LogLevel.Information,
  LogLevel.Warning,
  LogLevel.Error,
  LogLevel.Fatal,
];

/**
 * LogEntryDto. No id — a log line has none to give it, and the API doesn't invent one. Message can
 * be multi-line (a wrapped exception stack trace, or a multi-line entry like the Hangfire startup
 * banner, folded into one entry by LogService.Parse) — render it pre-wrapped, not as plain inline text.
 *
 * module/method are the class and method that actually logged the line (Serilog's CallerInfo
 * enricher, e.g. "WhatsAppSalesAutomation.Application.Conversations.ConversationService" /
 * "SendMessageAsync") — both null for lines written before that enricher existed, and for events
 * whose call frame never entered our own assemblies (some ASP.NET Core/EF Core/Hangfire internals).
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel | string;
  module: string | null;
  method: string | null;
  message: string;
}

/**
 * LogQueryRequest. date defaults to today (IST) server-side when omitted — see LogService. module
 * matches a substring of the logging class' namespace+name (e.g. "ConversationService" matches the
 * fully qualified "WhatsAppSalesAutomation.Application.Conversations.ConversationService").
 */
export interface LogQuery {
  date?: string;
  level?: string;
  module?: string;
  method?: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

export function logLevelChipClass(level: string): string {
  switch (level) {
    case LogLevel.Fatal:
    case LogLevel.Error:
      return 'status-chip status-chip--opted-out';
    case LogLevel.Warning:
      return 'status-chip status-chip--pending';
    case LogLevel.Information:
      return 'status-chip status-chip--opted-in';
    default:
      return 'status-chip status-chip--inactive';
  }
}
