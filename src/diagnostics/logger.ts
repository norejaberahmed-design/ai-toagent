/**
 * M4.5 — Central Diagnostic Logger
 * Centralized, observable, and isolated logging system.
 * Principle: Observability Layer — Logging never mutates or alters business logic.
 */

import { DiagnosticEvent, LogLevel } from './types';
import { sanitizeMessage, sanitizeMetadata } from './sanitizer';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  DEBUG: 1,
  INFO: 2,
  WARNING: 3,
  ERROR: 4,
  CRITICAL: 5,
};

export type EventSubscriber = (event: DiagnosticEvent) => void;

class CentralDiagnosticLogger {
  private static instance: CentralDiagnosticLogger;
  private currentLevel: LogLevel = 'INFO';
  private enabled: boolean = true;
  private events: DiagnosticEvent[] = [];
  private maxBufferSize: number = 1000;
  private subscribers: Set<EventSubscriber> = new Set();

  private constructor() {}

  public static getInstance(): CentralDiagnosticLogger {
    if (!CentralDiagnosticLogger.instance) {
      CentralDiagnosticLogger.instance = new CentralDiagnosticLogger();
    }
    return CentralDiagnosticLogger.instance;
  }

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  public getLevel(): LogLevel {
    return this.currentLevel;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public subscribe(subscriber: EventSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public log(event: Omit<DiagnosticEvent, 'timestamp'>): DiagnosticEvent {
    try {
      if (!this.enabled) {
        return { ...event, timestamp: new Date().toISOString() };
      }

      if (LEVEL_WEIGHT[event.level] < LEVEL_WEIGHT[this.currentLevel]) {
        return { ...event, timestamp: new Date().toISOString() };
      }

      const sanitizedEvent: DiagnosticEvent = {
        ...event,
        timestamp: new Date().toISOString(),
        message: sanitizeMessage(event.message),
        metadata: sanitizeMetadata(event.metadata),
      };

      // In-memory circular buffer
      this.events.push(sanitizedEvent);
      if (this.events.length > this.maxBufferSize) {
        this.events.shift();
      }

      // Notify live subscribers (wrapped in try-catch so subscriber errors don't impact logger)
      for (const subscriber of this.subscribers) {
        try {
          subscriber(sanitizedEvent);
        } catch {
          // Ignore subscriber failures
        }
      }

      return sanitizedEvent;
    } catch {
      // In the rare event logger fails, return event object without throwing
      return {
        ...event,
        timestamp: new Date().toISOString(),
      };
    }
  }

  public debug(
    event: string,
    message: string,
    context?: Partial<Omit<DiagnosticEvent, 'timestamp' | 'level' | 'event' | 'message'>>
  ): DiagnosticEvent {
    return this.log({
      level: 'DEBUG',
      event,
      message,
      component: context?.component || 'system',
      operation: context?.operation || 'general',
      status: context?.status || 'SUCCESS',
      ...context,
    });
  }

  public info(
    event: string,
    message: string,
    context?: Partial<Omit<DiagnosticEvent, 'timestamp' | 'level' | 'event' | 'message'>>
  ): DiagnosticEvent {
    return this.log({
      level: 'INFO',
      event,
      message,
      component: context?.component || 'system',
      operation: context?.operation || 'general',
      status: context?.status || 'SUCCESS',
      ...context,
    });
  }

  public warning(
    event: string,
    message: string,
    context?: Partial<Omit<DiagnosticEvent, 'timestamp' | 'level' | 'event' | 'message'>>
  ): DiagnosticEvent {
    return this.log({
      level: 'WARNING',
      event,
      message,
      component: context?.component || 'system',
      operation: context?.operation || 'general',
      status: context?.status || 'WARNING',
      ...context,
    });
  }

  public error(
    event: string,
    message: string,
    context?: Partial<Omit<DiagnosticEvent, 'timestamp' | 'level' | 'event' | 'message'>>
  ): DiagnosticEvent {
    return this.log({
      level: 'ERROR',
      event,
      message,
      component: context?.component || 'system',
      operation: context?.operation || 'general',
      status: context?.status || 'FAILED',
      ...context,
    });
  }

  public critical(
    event: string,
    message: string,
    context?: Partial<Omit<DiagnosticEvent, 'timestamp' | 'level' | 'event' | 'message'>>
  ): DiagnosticEvent {
    return this.log({
      level: 'CRITICAL',
      event,
      message,
      component: context?.component || 'system',
      operation: context?.operation || 'general',
      status: context?.status || 'FAILED',
      ...context,
    });
  }

  public getEvents(filter?: {
    analysisId?: string;
    level?: LogLevel;
    component?: string;
    errorOnly?: boolean;
  }): DiagnosticEvent[] {
    let result = [...this.events];

    if (filter?.analysisId) {
      result = result.filter((e) => e.analysis_id === filter.analysisId);
    }

    if (filter?.level) {
      result = result.filter((e) => e.level === filter.level);
    }

    if (filter?.component) {
      result = result.filter((e) => e.component === filter.component);
    }

    if (filter?.errorOnly) {
      result = result.filter((e) => e.level === 'ERROR' || e.level === 'CRITICAL');
    }

    return result;
  }

  public clear(): void {
    this.events = [];
  }
}

export const diagnosticLogger = CentralDiagnosticLogger.getInstance();
