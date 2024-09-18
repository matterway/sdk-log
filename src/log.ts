import {Context} from '@matterway/sdk-context';
import {BrowserInfo, Log, LogType, SkillInfo} from './types';
const {version} = require('../package.json') as {version: string};
import {LOREM_TEXT, API_URL} from './constants';

class Logger {
  browserInfo: BrowserInfo;
  skillInfo: SkillInfo;
  initialized: number;

  snapshot?: string;
  version: string;
  logs: Log[];

  constructor(browserInfo: BrowserInfo, skillInfo: SkillInfo) {
    this.browserInfo = browserInfo;
    this.skillInfo = skillInfo;
    this.initialized = Date.now();
    this.logs = [];
    this.version = version;
  }

  public setSnapshot(snapshot: string) {
    this.snapshot = snapshot;
  }

  public addLog(log: Log) {
    this.logs.push(log);
  }

  public getLogs() {
    return {
      skillInfo: this.skillInfo,
      browserInfo: this.browserInfo,
      version: this.version,
      initialized: this.initialized,
      logs: this.logs,
      ...(this.snapshot ? {snapshot: this.snapshot} : {}),
    };
  }
}

let logger: Logger;

export async function useLogger(init?: {ctx: Context; skill: SkillInfo}) {
  if (!init && !logger) {
    throw new Error('Logger is not initialized.');
  }

  if (!init) {
    return logger;
  }

  const {ctx, skill} = init;
  const {page, browser} = ctx;

  const userAgent = await browser.userAgent();
  const browserVersion = await browser.version();
  const height = await page.evaluate(() => window.innerHeight);
  const width = await page.evaluate(() => window.innerWidth);

  const browserInfo: BrowserInfo = {
    userAgent,
    version: browserVersion,
    height,
    width,
  };

  ctx.signal.addEventListener('abort', () => revertMethodsToOriginal());
  const exErr = console.error;
  const exDebug = console.debug;
  const exLog = console.log;
  const exWarn = console.warn;
  const exInfo = console.info;

  const {identifier, name, version} = skill;

  const skillInfo: SkillInfo = {identifier, name, version};

  logger = new Logger(browserInfo, skillInfo);

  console.debug('Creating logger', {
    skill: {
      identifier: skill.identifier,
      name: skill.name,
      version: skill.version,
    },
    browserInfo,
  });

  console.debug = function (...message) {
    const timestamp = Date.now();
    const trace = getStackTrace();

    logger.addLog({
      type: LogType.Debug,
      message: [...message],
      trace,
      timestamp,
      url: page.url(),
    });
    exDebug.apply(this, message);
  };

  console.error = async function (...messagesOrErr: (any | Error)[]) {
    const trace =
      messagesOrErr[0] instanceof Error
        ? getStackTrace(messagesOrErr[0])
        : getStackTrace();
    const message =
      messagesOrErr[0] instanceof Error
        ? [messagesOrErr[0].message]
        : [...messagesOrErr];
    const timestamp = Date.now();

    const snapshot = await page.evaluate(async (loremText: string) => {
      const ReplaceData = async (element: Element) => {
        element.removeAttribute('value');
        const subElements = element.querySelectorAll(':scope > *');
        if (subElements.length <= 0 && element.textContent) {
          element.textContent =
            element.textContent && element.textContent.length > 0
              ? loremText.slice(0, element.textContent.length).trim()
              : '';
        }
        subElements.forEach(async (node) => {
          const subSubElements = node.querySelectorAll(':scope > *');
          if (subSubElements.length > 0) {
            node.removeAttribute('value');
            subSubElements.forEach(async (subnode) => {
              await ReplaceData(subnode);
            });
          } else {
            node.textContent =
              node.textContent && node.textContent.length > 0
                ? loremText.slice(0, node.textContent.length).trim()
                : '';
            node.removeAttribute('value');
          }
        });
      };

      await ReplaceData(document.body);

      return document.body.innerHTML;
    }, LOREM_TEXT);

    const log: Log = {
      type: LogType.Error,
      message,
      trace,
      timestamp,
      url: page.url(),
    };
    logger.setSnapshot(snapshot);
    logger.addLog(log);
    exErr.apply(this, message);
  };

  console.log = function (...message) {
    const timestamp = Date.now();
    const trace = getStackTrace();
    logger.addLog({
      type: LogType.Log,
      message: [...message],
      trace,
      timestamp,
      url: page.url(),
    });
    exLog.apply(this, message);
  };

  console.warn = function (...message) {
    const timestamp = Date.now();
    const trace = getStackTrace();
    logger.addLog({
      type: LogType.Warn,
      message: [...message],
      trace,
      timestamp,
      url: page.url(),
    });
    exWarn.apply(this, message);
  };

  console.info = function (...message) {
    const timestamp = Date.now();
    const trace = getStackTrace();

    logger.addLog({
      type: LogType.Info,
      message: [...message],
      trace,
      timestamp,
      url: page.url(),
    });
    exInfo.apply(this, message);
  };

  function revertMethodsToOriginal() {
    console.error = exErr;
    console.debug = exDebug;
    console.log = exLog;
    console.warn = exWarn;
    console.info = exInfo;
  }

  return logger;
}

function getStackTrace(err: Error = new Error()) {
  return (
    err.stack
      ?.split('\n')
      .splice(1)
      .map((line) => line.trim()) || []
  );
}

function generateReportName() {
  const d = Date.now();
  return `mw-error-log-${d}.json`;
}
function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  document.body.appendChild(a);
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => {
    return window.URL.revokeObjectURL(url);
  }, 1000);
}
/**
 * Filter circular object for JSON.stringify()
 */
function getCircularReplacer() {
  const seen = new WeakSet();
  return (_key: any, value: unknown) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
}

/** @experimental */
export function downloadReport() {
  const fileName = generateReportName();
  const stringLogs = JSON.stringify(logger.getLogs(), getCircularReplacer());
  const logBlob = new Blob([stringLogs], {type: 'application/json'});
  downloadBlob(logBlob, fileName);
}

/** @experimental */
export function getJSONreport() {
  const stringLogs = JSON.stringify(logger.getLogs(), getCircularReplacer());
  return stringLogs;
}

/**
 * @experimental
 * Sends the collected logs to the logger API. Returns a promise that resolves to true
 * if the logs were sent successfully, false otherwise. You can optionally pass the API
 * URL to send the logs to. If no URL is passed, the logs will be sent to the default
 * logger API.
 * @param apiURL Optional API URL to send the logs to. Only use it for development purposes.
 * @returns Promise that resolves to true if the logs were sent successfully, false otherwise.
 */
export async function sendLogs(apiURL?: string): Promise<boolean> {
  try {
    const res = await fetch(apiURL ?? API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logger.getLogs()),
    });
    return res.ok;
  } catch (_ignored) {
    return false;
  }
}
