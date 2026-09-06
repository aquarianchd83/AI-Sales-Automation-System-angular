import { LogLevel, logLevelChipClass } from './log.model';

describe('logLevelChipClass', () => {
  it('flags Fatal and Error the same as an opted-out/destructive state', () => {
    expect(logLevelChipClass(LogLevel.Fatal)).toBe('status-chip status-chip--opted-out');
    expect(logLevelChipClass(LogLevel.Error)).toBe('status-chip status-chip--opted-out');
  });

  it('flags Warning as a pending-style caution', () => {
    expect(logLevelChipClass(LogLevel.Warning)).toBe('status-chip status-chip--pending');
  });

  it('flags Information as a healthy/opted-in state', () => {
    expect(logLevelChipClass(LogLevel.Information)).toBe('status-chip status-chip--opted-in');
  });

  it('falls back to a neutral/inactive chip for Debug, Verbose, and anything unrecognized', () => {
    expect(logLevelChipClass(LogLevel.Debug)).toBe('status-chip status-chip--inactive');
    expect(logLevelChipClass(LogLevel.Verbose)).toBe('status-chip status-chip--inactive');
    expect(logLevelChipClass('SomethingUnexpected')).toBe('status-chip status-chip--inactive');
  });
});
