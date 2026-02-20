"use client";

import type { DraftEntityType, EventType } from "./activity-log";

type DraftEventType = Extract<
  EventType,
  "DRAFT_START" | "DRAFT_COMMIT" | "DRAFT_PAUSE" | "DRAFT_REOPEN"
>;

type DraftEventPayload = {
  entityType: DraftEntityType;
  entityId: string;
  actorId: string | null;
  sessionId: string;
  durationMs: number;
  clientTs?: Date | string;
  pauseMs?: number;
  metadata?: Record<string, unknown>;
};

const ALLOWED_ENTITY_TYPES: ReadonlySet<DraftEntityType> = new Set([
  "chart",
  "injury",
  "record",
]);

async function postDraftEvent(
  eventType: DraftEventType,
  payload: DraftEventPayload,
): Promise<void> {
  void eventType;
  void payload;
}

export async function logDraftStart(
  entityType: DraftEntityType,
  entityId: string,
  actorId: string | null,
  sessionId: string,
  clientTs?: Date | string,
): Promise<void> {
  await postDraftEvent("DRAFT_START", {
    entityType,
    entityId,
    actorId,
    sessionId,
    durationMs: 0,
    clientTs,
  });
}

export async function logDraftCommit(
  entityType: DraftEntityType,
  entityId: string,
  actorId: string | null,
  sessionId: string,
  durationMs: number,
  clientTs?: Date | string,
): Promise<void> {
  await postDraftEvent("DRAFT_COMMIT", {
    entityType,
    entityId,
    actorId,
    sessionId,
    durationMs,
    clientTs,
  });
}

export async function logDraftPause(
  entityType: DraftEntityType,
  entityId: string,
  actorId: string | null,
  sessionId: string,
  pauseMs: number,
  clientTs?: Date | string,
): Promise<void> {
  await postDraftEvent("DRAFT_PAUSE", {
    entityType,
    entityId,
    actorId,
    sessionId,
    durationMs: pauseMs,
    clientTs,
    pauseMs,
  });
}

export async function logDraftReopen(
  entityType: DraftEntityType,
  entityId: string,
  actorId: string | null,
  sessionId: string,
  clientTs?: Date | string,
): Promise<void> {
  await postDraftEvent("DRAFT_REOPEN", {
    entityType,
    entityId,
    actorId,
    sessionId,
    durationMs: 0,
    clientTs,
  });
}

export function generateSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const DRAFT_ENTITY_TYPES = ALLOWED_ENTITY_TYPES;
