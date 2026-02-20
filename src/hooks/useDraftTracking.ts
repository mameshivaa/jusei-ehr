"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DraftEntityType } from "@/lib/activity-log";
import {
  generateSessionId,
  logDraftCommit,
  logDraftPause,
  logDraftReopen,
  logDraftStart,
} from "@/lib/draft-session-log";

const DEFAULT_IDLE_THRESHOLD_MS = 30_000; // 30秒無操作でpauseイベント送出

export type DraftTrackingOptions = {
  entityType: DraftEntityType;
  entityId: string | null;
  actorId: string | null;
  enabled?: boolean;
  idleThresholdMs?: number;
};

export type DraftTrackingHandle = {
  sessionId: string | null;
  /** 入力などのアクティビティ発生時に呼び出す */
  notifyActivity: () => void;
  /** フォームが初めてdirtyになった瞬間でも可（notifyActivityと兼用可） */
  markDirty: () => void;
  /** 保存完了時に呼び出し、draft_commitを送る */
  markCommit: () => Promise<void>;
  /** 保存後に再編集開始する場合に呼び出す（新しいsession_idを採番） */
  markReopen: () => Promise<void>;
};

export function useDraftTracking(
  options: DraftTrackingOptions,
): DraftTrackingHandle {
  const {
    entityType,
    entityId,
    actorId,
    enabled = true,
    idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
  } = options;

  const storageKey = useMemo(
    () =>
      entityId
        ? `draft-session:${entityType}:${entityId}`
        : "draft-session:unset",
    [entityId, entityType],
  );

  const [sessionId, setSessionId] = useState<string | null>(null);

  const startedRef = useRef(false);
  const startAtRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number | null>(null);
  const pauseAccumulatedRef = useRef(0);
  const pausedRef = useRef(false);
  const pauseStartRef = useRef<number | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  const schedulePauseTimer = useCallback(() => {
    clearPauseTimer();
    pauseTimerRef.current = setTimeout(() => {
      const lastActivity = lastActivityRef.current;
      if (!lastActivity || pausedRef.current) return;
      const now = Date.now();
      const pauseDuration = now - lastActivity;
      if (pauseDuration < idleThresholdMs) return;

      // startAtがある場合のみアクティブ時間を計算
      if (startAtRef.current && !pausedRef.current) {
        // 無操作開始を記録（pauseDurationは復帰/保存時に正確に計算）
        pausedRef.current = true;
        pauseStartRef.current = lastActivity;
      }
    }, idleThresholdMs);
  }, [clearPauseTimer, idleThresholdMs]);

  const finalizePauseIfNeeded = useCallback(
    (now: number) => {
      if (!pausedRef.current || !lastActivityRef.current) return;
      const pauseStart = pauseStartRef.current ?? lastActivityRef.current;
      const pauseDuration = Math.max(0, now - pauseStart);
      if (pauseDuration > 0) {
        pauseAccumulatedRef.current += pauseDuration;
        void logDraftPause(
          entityType,
          entityId || "",
          actorId,
          sessionId || "",
          pauseDuration,
          new Date(now),
        );
      }
      pausedRef.current = false;
      pauseStartRef.current = null;
    },
    [actorId, entityId, entityType, sessionId],
  );

  const ensureSession = useCallback(() => {
    if (!enabled || !entityId) return null;
    if (sessionId) return sessionId;

    try {
      const fromStorage = sessionStorage.getItem(storageKey);
      const next = fromStorage || generateSessionId();
      sessionStorage.setItem(storageKey, next);
      setSessionId(next);
      return next;
    } catch (error) {
      console.warn("failed to access sessionStorage for draft tracking", error);
      const next = generateSessionId();
      setSessionId(next);
      return next;
    }
  }, [enabled, entityId, sessionId, storageKey]);

  useEffect(() => {
    // エンティティが変わったら状態をリセット
    startedRef.current = false;
    startAtRef.current = null;
    lastActivityRef.current = null;
    pauseAccumulatedRef.current = 0;
    pausedRef.current = false;
    pauseStartRef.current = null;
    clearPauseTimer();
    setSessionId(null);
  }, [clearPauseTimer, storageKey]);

  useEffect(() => {
    if (!enabled || !entityId) return;
    ensureSession();
    return () => clearPauseTimer();
  }, [clearPauseTimer, enabled, ensureSession, entityId, storageKey]);

  const startIfNeeded = useCallback(async () => {
    if (!enabled || !entityId || !actorId) return;
    const sid = ensureSession();
    if (!sid || startedRef.current) return;

    startedRef.current = true;
    pausedRef.current = false;
    pauseAccumulatedRef.current = 0;
    const now = Date.now();
    startAtRef.current = now;
    lastActivityRef.current = now;
    await logDraftStart(entityType, entityId, actorId, sid, new Date());
    schedulePauseTimer();
  }, [
    actorId,
    enabled,
    ensureSession,
    entityId,
    entityType,
    schedulePauseTimer,
  ]);

  const markDirty = useCallback(() => {
    console.log("[useDraftTracking] markDirty called", {
      enabled,
      entityId,
      actorId,
    });
    if (!enabled || !entityId || !actorId) {
      console.log("[useDraftTracking] markDirty skipped", {
        enabled,
        entityId,
        actorId,
      });
      return;
    }
    void startIfNeeded();
    const now = Date.now();
    finalizePauseIfNeeded(now);
    lastActivityRef.current = now;
    if (pausedRef.current) {
      pausedRef.current = false;
    }
    schedulePauseTimer();
  }, [
    actorId,
    enabled,
    entityId,
    finalizePauseIfNeeded,
    schedulePauseTimer,
    startIfNeeded,
  ]);

  const notifyActivity = useCallback(() => {
    console.log("[useDraftTracking] notifyActivity called", {
      enabled,
      entityId,
      actorId,
    });
    if (!enabled || !entityId || !actorId) {
      console.log("[useDraftTracking] notifyActivity skipped", {
        enabled,
        entityId,
        actorId,
      });
      return;
    }
    const sid = ensureSession();
    if (!sid) return;
    if (!startedRef.current) {
      markDirty();
      return;
    }
    const now = Date.now();
    finalizePauseIfNeeded(now);
    lastActivityRef.current = now;
    pausedRef.current = false;
    schedulePauseTimer();
  }, [
    actorId,
    enabled,
    ensureSession,
    entityId,
    finalizePauseIfNeeded,
    markDirty,
    schedulePauseTimer,
  ]);

  const markCommit = useCallback(async () => {
    if (!enabled || !entityId || !actorId) return;
    const sid = ensureSession();
    if (!sid || !startedRef.current || !startAtRef.current) return;

    clearPauseTimer();

    const now = Date.now();
    finalizePauseIfNeeded(now);

    const duration = Math.max(
      0,
      now - startAtRef.current - pauseAccumulatedRef.current,
    );

    await logDraftCommit(
      entityType,
      entityId,
      actorId,
      sid,
      duration,
      new Date(),
    );

    // sessionは維持しつつ次回再編集で再開できるようフラグだけ戻す
    startedRef.current = false;
    startAtRef.current = null;
    lastActivityRef.current = null;
    pauseAccumulatedRef.current = 0;
    pausedRef.current = false;
    pauseStartRef.current = null;
  }, [
    actorId,
    clearPauseTimer,
    enabled,
    ensureSession,
    entityId,
    entityType,
    finalizePauseIfNeeded,
  ]);

  const markReopen = useCallback(async () => {
    if (!enabled || !entityId || !actorId) return;
    const nextSession = generateSessionId();
    try {
      sessionStorage.setItem(storageKey, nextSession);
    } catch (error) {
      console.warn("failed to persist session id for reopen", error);
    }
    setSessionId(nextSession);
    startedRef.current = false;
    startAtRef.current = null;
    lastActivityRef.current = null;
    pauseAccumulatedRef.current = 0;
    pausedRef.current = false;
    pauseStartRef.current = null;
    await logDraftReopen(
      entityType,
      entityId,
      actorId,
      nextSession,
      new Date(),
    );
  }, [actorId, enabled, entityId, entityType, storageKey]);

  return {
    sessionId,
    notifyActivity,
    markDirty,
    markCommit,
    markReopen,
  };
}
