export interface SkillInfo {
  identifier: string;
  name: string;
  version: string;
}

export interface BrowserInfo {
  userAgent: string;
  version: string;
  height: number;
  width: number;
}

export enum LogType {
  Log = 'log',
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
}

export interface Log {
  type: LogType;
  trace: string[];
  message: string[];
  timestamp: number;
  url: string;
  snapshot?: string;
}
