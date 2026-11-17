import type { BrowserName } from "./browser-info";
import type { PairResult } from "./pairing";
import type { KeyValueStore, Post } from "./storage";
import type { TrackerEvent } from "./tracker";

export interface ControllerDeps {
  store: KeyValueStore;
  post: Post;
  baseUrl: string;
  extensionVersion: string;
  os: string;
  log: (message: string) => void;
}

export interface Controller {
  handleEvent(event: TrackerEvent): Promise<void>;
  onAlarm(now: number): Promise<void>;
  pair(code: string, browser: BrowserName): Promise<PairResult>;
}

export function createController(_deps: ControllerDeps): Controller {
  throw new Error("not implemented");
}

export function registerSchedule(_api: {
  alarms: { create(name: string, info: { periodInMinutes: number }): unknown };
  idle: { setDetectionInterval(seconds: number): unknown };
}): void {
  throw new Error("not implemented");
}
