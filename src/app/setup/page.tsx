"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { DiskEncryptionGuide } from "@/components/setup/DiskEncryptionGuide";
import { OperationsConfirmation } from "@/components/setup/OperationsConfirmation";
import { BackupSettings } from "@/components/setup/BackupSettings";
import { Select } from "@/components/ui/Select";

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [securityOfficerRolePreset, setSecurityOfficerRolePreset] =
    useState("");
  const [securityOfficerRoleCustom, setSecurityOfficerRoleCustom] =
    useState("");
  const [securityOfficerLastName, setSecurityOfficerLastName] = useState("");
  const [securityOfficerFirstName, setSecurityOfficerFirstName] = useState("");
  const [adminRolePreset, setAdminRolePreset] = useState("");
  const [adminRoleCustom, setAdminRoleCustom] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminIdentifier, setAdminIdentifier] = useState("");
  const [sameAsOfficer, setSameAsOfficer] = useState(false);
  const [encryptionConfirmed, setEncryptionConfirmed] = useState(false);
  const [operationsConfirmed, setOperationsConfirmed] = useState(false);
  const [longDocConfirmed, setLongDocConfirmed] = useState(false);
  const [longDocReady, setLongDocReady] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryCodeConfirmed, setRecoveryCodeConfirmed] = useState(false);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [backupDirectory, setBackupDirectory] = useState("");
  const [backupSecret, setBackupSecret] = useState("");
  const [backupSource, setBackupSource] = useState<
    "external" | "default" | "custom"
  >("default");
  const [backupSourceTouched, setBackupSourceTouched] = useState(false);
  const [externalAvailable, setExternalAvailable] = useState(true);
  const [backupLoading, setBackupLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [step, setStep] = useState(0);
  const stepChangeTimeRef = useRef<number>(Date.now());
  const longDocRef = useRef<HTMLDivElement | null>(null);
  const isSubmittingRef = useRef(false);
  const [contentVisible, setContentVisible] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [backupMinHeight, setBackupMinHeight] = useState<number | null>(null);

  const panelClass =
    "w-full rounded-md border border-slate-200 bg-white px-5 py-3";
  const panelInnerClass = "grid gap-4 md:grid-cols-[220px,1fr] items-center";
  const descTextClass = "text-sm text-slate-500";

  const STEP_ENCRYPTION = 0;
  const STEP_SECURITY_OFFICER = 1;
  const STEP_ADMIN = 2;
  const STEP_OPERATIONS = 3;
  const STEP_BACKUP = 4;
  const STEP_RECOVERY = 5;
  const STEP_POLICY = 6;

  const steps = [
    { title: "PC端末の暗号化", description: "端末の暗号化を確認" },
    { title: "安全管理責任者", description: "運用責任者を登録" },
    { title: "管理者ログイン", description: "IDとパスワード" },
    { title: "運用体制", description: "確認と遵守" },
    { title: "バックアップ", description: "自動設定" },
    { title: "PW紛失時", description: "復旧コードを保管" },
    { title: "重要事項", description: "運用の前提を確認" },
  ];
  const ROLE_CUSTOM_VALUE = "custom";
  const roleOptions = [
    { value: "院長", label: "院長" },
    { value: "副院長", label: "副院長" },
    { value: "事務長", label: "事務長" },
    { value: "施術責任者", label: "施術責任者" },
    { value: "管理者", label: "管理者" },
    { value: ROLE_CUSTOM_VALUE, label: "その他（自由入力）" },
  ];
  const resolveRole = (preset: string, custom: string) => {
    const trimmedPreset = preset.trim();
    if (trimmedPreset === ROLE_CUSTOM_VALUE) {
      return custom.trim();
    }
    return trimmedPreset;
  };
  const buildFullName = (last: string, first: string) => {
    const lastTrim = last.trim();
    const firstTrim = first.trim();
    if (!lastTrim && !firstTrim) return "";
    return `${lastTrim} ${firstTrim}`.trim();
  };
  const progressPercentage =
    steps.length > 1 ? (step / (steps.length - 1)) * 100 : 100;
  const progressFillHeight = step === 0 ? "6px" : `${progressPercentage}%`;
  const progressIndicatorTop =
    step === 0 ? "0px" : `calc(${progressPercentage}% - 6px)`;

  const generateRecoveryCode = useCallback(() => {
    if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes)
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
    }
    // Fallback for environments without Web Crypto
    const hex = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
    return hex;
  }, []);

  const formatRecoveryCode = useCallback((code: string) => {
    const normalized = code.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
    const groups = normalized.match(/.{1,4}/g) || [];
    return groups.join("-");
  }, []);

  const handleCopyRecoveryCode = useCallback(async () => {
    if (!recoveryCode) return;
    try {
      await navigator.clipboard.writeText(formatRecoveryCode(recoveryCode));
      setRecoveryCopied(true);
      setTimeout(() => setRecoveryCopied(false), 1500);
    } catch (copyError) {
      console.error("Failed to copy recovery code:", copyError);
    }
  }, [recoveryCode, formatRecoveryCode]);

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateStepErrors = (target: number): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (target === STEP_ENCRYPTION) {
      if (!encryptionConfirmed) {
        errors.encryptionConfirmed = "ディスク暗号化の確認が必要です";
      }
      return errors;
    }

    if (target === STEP_SECURITY_OFFICER) {
      if (!securityOfficerRolePreset.trim()) {
        errors.securityOfficerRole = "安全管理責任者の役職を入力してください";
      }
      if (
        securityOfficerRolePreset.trim() === ROLE_CUSTOM_VALUE &&
        !securityOfficerRoleCustom.trim()
      ) {
        errors.securityOfficerRole = "安全管理責任者の役職を入力してください";
      }
      if (!securityOfficerLastName.trim()) {
        errors.securityOfficerLastName = "安全管理責任者の姓を入力してください";
      }
      if (!securityOfficerFirstName.trim()) {
        errors.securityOfficerFirstName =
          "安全管理責任者の名を入力してください";
      }
      return errors;
    }

    if (target === STEP_ADMIN) {
      if (!sameAsOfficer) {
        if (!adminRolePreset.trim()) {
          errors.adminRole = "管理者の役職を入力してください";
        }
        if (
          adminRolePreset.trim() === ROLE_CUSTOM_VALUE &&
          !adminRoleCustom.trim()
        ) {
          errors.adminRole = "管理者の役職を入力してください";
        }
        if (!adminLastName.trim()) {
          errors.adminLastName = "管理者の姓を入力してください";
        }
        if (!adminFirstName.trim()) {
          errors.adminFirstName = "管理者の名を入力してください";
        }
      }
      if (!adminIdentifier.trim()) {
        errors.adminIdentifier = "管理者IDを入力してください";
      }
      if (!password) {
        errors.adminPassword = "パスワードを入力してください";
      }
      if (!passwordConfirm) {
        errors.adminPasswordConfirm = "確認用パスワードを入力してください";
      } else if (password !== passwordConfirm) {
        errors.adminPasswordConfirm = "確認用パスワードが一致しません";
      }
      return errors;
    }

    if (target === STEP_OPERATIONS) {
      if (!operationsConfirmed) {
        errors.operationsConfirmed = "運用体制の内容確認が必要です";
      }
      return errors;
    }

    if (target === STEP_BACKUP) {
      if (backupSecret.trim().length < 8) {
        errors.backupSecret = "BACKUP_SECRET は8文字以上の設定が必要です";
      }
      return errors;
    }

    if (target === STEP_RECOVERY) {
      if (!recoveryCode) {
        errors.recoveryCode =
          "復旧コードの生成に失敗しました。ページを再読み込みしてください。";
      }
      if (!recoveryCodeConfirmed) {
        errors.recoveryCodeConfirmed = "復旧コードの保存確認が必要です";
      }
      return errors;
    }

    if (target === STEP_POLICY) {
      if (!longDocConfirmed) {
        errors.longDocConfirmed = "重要事項の内容を確認してください";
      }
      return errors;
    }

    return errors;
  };

  const validateStep = (target: number): boolean => {
    const errors = validateStepErrors(target);
    logValidationDebug(target, errors);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = errors[Object.keys(errors)[0]];
      setError(firstError);
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const getFieldError = (key: string) => fieldErrors[key];

  const getInputClassName = (key: string) =>
    `form-input w-full ${
      getFieldError(key)
        ? "border-red-500 bg-red-50/40"
        : "border-slate-300 bg-white"
    }`;

  const getCheckboxClassName = (invalid?: boolean) =>
    `form-checkbox aspect-square flex-shrink-0 ${invalid ? "border-red-500" : ""}`;

  const logValidationDebug = (
    target: number,
    errors: Record<string, string>,
  ) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("debug")) return;
    const payload = {
      step: target,
      errors,
      encryptionConfirmed,
      securityOfficerRolePreset,
      securityOfficerRoleCustom,
      securityOfficerLastName,
      securityOfficerFirstName,
      adminRolePreset,
      adminRoleCustom,
      adminLastName,
      adminFirstName,
      adminIdentifier,
      sameAsOfficer,
      passwordLength: password.length,
      passwordConfirmLength: passwordConfirm.length,
      passwordMatches: password === passwordConfirm,
      operationsConfirmed,
      longDocConfirmed,
      longDocReady,
      recoveryCodeConfirmed,
      recoveryCodeReady: !!recoveryCode,
    };
    (window as Window & { __setupDebug?: unknown }).__setupDebug = payload;
    console.groupCollapsed("[Setup Validation Debug]");
    console.table(payload);
    console.log("Errors:", errors);
    console.groupEnd();
  };

  const handleNext = () => {
    setError("");
    if (validateStep(step)) {
      stepChangeTimeRef.current = Date.now();
      setStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setError("");
    stepChangeTimeRef.current = Date.now();
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStepSelect = (target: number) => {
    if (target === step) return;
    setError("");
    if (target > step) {
      for (let i = 0; i < target; i += 1) {
        if (!validateStep(i)) {
          setStep(i);
          return;
        }
      }
    }
    stepChangeTimeRef.current = Date.now();
    setStep(target);
  };

  // セットアップ状態をチェック
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch("/api/setup/status");
        if (response.ok) {
          const data = await response.json();
          if (data.isSetupComplete) {
            setIsSetupComplete(true);
            router.push("/welcome");
          }
        }
      } catch (err) {
        // エラーは無視（セットアップ未完了の可能性）
      }
    };
    checkSetupStatus();
  }, [router]);

  const detectBackupLocation = useCallback(async () => {
    try {
      setBackupLoading(true);
      const response = await fetch("/api/backup/location");
      if (response.ok) {
        const data = await response.json();
        if (data?.directory) {
          setBackupDirectory(data.directory);
        }
        const detectedSource =
          data?.source === "external" || data?.source === "default"
            ? data.source
            : "default";
        setExternalAvailable(detectedSource === "external");
        if (!backupSourceTouched) {
          setBackupSource(detectedSource);
        }
        return;
      }
      // エラー時もレスポンスからデフォルト値を取得を試みる
      try {
        const errorData = await response.json();
        if (errorData?.directory && !backupDirectory) {
          setBackupDirectory(errorData.directory);
        }
      } catch {
        // JSONパースに失敗した場合は無視
      }
      setExternalAvailable(false);
      setBackupSource("default");
    } catch {
      // fallback to current value
      setExternalAvailable(false);
      if (!backupSourceTouched) {
        setBackupSource("default");
      }
    } finally {
      setBackupLoading(false);
    }
  }, [backupSourceTouched, backupDirectory]);

  const handleBackupDirectoryChange = useCallback((value: string) => {
    setBackupDirectory(value);
    setBackupSource("custom");
    setBackupSourceTouched(true);
  }, []);

  const handleBackupSourceChange = useCallback(
    (source: "external" | "default" | "custom") => {
      setBackupSource(source);
      setBackupSourceTouched(true);
      if (source === "external") {
        void detectBackupLocation();
      }
    },
    [detectBackupLocation],
  );

  useEffect(() => {
    if (!sameAsOfficer) return;
    setAdminRolePreset(securityOfficerRolePreset);
    setAdminRoleCustom(securityOfficerRoleCustom);
    setAdminLastName(securityOfficerLastName);
    setAdminFirstName(securityOfficerFirstName);
    clearFieldError("adminRole");
    clearFieldError("adminLastName");
    clearFieldError("adminFirstName");
  }, [
    sameAsOfficer,
    securityOfficerRolePreset,
    securityOfficerRoleCustom,
    securityOfficerLastName,
    securityOfficerFirstName,
  ]);

  useEffect(() => {
    detectBackupLocation();
  }, [detectBackupLocation]);

  useEffect(() => {
    // ステップ変更時にエラーをリセット
    setError("");
    stepChangeTimeRef.current = Date.now();
    if (step !== STEP_POLICY) {
      setLongDocReady(false);
    }
  }, [step, error]);

  useEffect(() => {
    setContentVisible(false);
    const timer = setTimeout(() => setContentVisible(true), 30);
    return () => clearTimeout(timer);
  }, [step, error]);

  useEffect(() => {
    if (step !== STEP_BACKUP) return;
    const rafId = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      setBackupMinHeight(cardRef.current.offsetHeight);
    });
    return () => cancelAnimationFrame(rafId);
  }, [step, backupLoading, backupDirectory, backupSource, contentVisible]);

  useEffect(() => {
    if (step !== STEP_POLICY) return;
    const el = longDocRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
      if (atBottom) {
        setLongDocReady(true);
        if (error) {
          setError("");
        }
      } else {
        setLongDocReady(false);
      }
    };
    handleScroll();
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [step, error]);

  useEffect(() => {
    setLongDocConfirmed(longDocReady);
    if (longDocReady) {
      clearFieldError("longDocConfirmed");
    }
  }, [longDocReady]);

  useEffect(() => {
    if (step !== STEP_RECOVERY) return;
    if (recoveryCode) return;
    const code = generateRecoveryCode();
    if (code) {
      setRecoveryCode(code);
    }
  }, [step, recoveryCode, generateRecoveryCode]);

  useEffect(() => {
    if (recoveryCodeConfirmed) {
      clearFieldError("recoveryCodeConfirmed");
    }
  }, [recoveryCodeConfirmed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 重複送信を防ぐ
    if (isSubmittingRef.current || isSetupComplete) {
      console.log("[Setup] Submit blocked: already submitting or complete");
      return;
    }

    console.log("[Setup] Starting submit...");
    setError("");
    setLoading(true);
    isSubmittingRef.current = true;

    // すべてのステップをバリデーション
    for (let targetStep = 0; targetStep < steps.length; targetStep += 1) {
      if (!validateStep(targetStep)) {
        console.log(`[Setup] Validation failed at step ${targetStep}`);
        setStep(targetStep);
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }
    }

    // 最終ステップ以外はsubmitを防ぐ
    if (step !== STEP_POLICY) {
      console.log(
        `[Setup] Submit blocked: not on final step (current: ${step})`,
      );
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    try {
      console.log("[Setup] Sending request to /api/setup");

      // backupDirectoryが空の場合は、APIから取得したデフォルト値を使用
      // APIが失敗した場合は、送信時に空文字列を送信（サーバー側でデフォルト値を使用）
      const finalBackupDirectory = backupDirectory.trim() || "";
      const effectiveSecurityOfficerRole = resolveRole(
        securityOfficerRolePreset,
        securityOfficerRoleCustom,
      );
      const effectiveSecurityOfficerName = buildFullName(
        securityOfficerLastName,
        securityOfficerFirstName,
      );
      const effectiveAdminRole = sameAsOfficer
        ? effectiveSecurityOfficerRole
        : resolveRole(adminRolePreset, adminRoleCustom);
      const effectiveAdminName = sameAsOfficer
        ? effectiveSecurityOfficerName
        : buildFullName(adminLastName, adminFirstName);

      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          securityOfficer: {
            role: effectiveSecurityOfficerRole,
            name: effectiveSecurityOfficerName,
          },
          confirmations: {
            incidentContact: operationsConfirmed,
            backupPolicy: operationsConfirmed,
            bcp: operationsConfirmed,
            accessLog: operationsConfirmed,
            operationPolicy: operationsConfirmed,
          },
          backup: {
            directory: finalBackupDirectory,
            secret: backupSecret,
            source: backupSource,
          },
          admin: {
            role: effectiveAdminRole,
            name: effectiveAdminName,
            identifier: adminIdentifier.trim(),
            password,
          },
          agreements: {
            terms: longDocConfirmed,
            privacy: longDocConfirmed,
          },
          recoveryCode,
        }),
      });

      console.log("[Setup] Response status:", response.status, response.ok);

      if (!response.ok) {
        let errorMessage = "セットアップに失敗しました";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error("[Setup] Error response:", errorData);
        } catch (parseError) {
          // JSONパースに失敗した場合は、ステータステキストを使用
          errorMessage = `サーバーエラー: ${response.status} ${response.statusText}`;
          console.error("[Setup] Failed to parse error response:", parseError);
        }

        // 既にセットアップ済みの場合はリダイレクト
        if (errorMessage.includes("既にセットアップが完了しています")) {
          console.log("[Setup] Already setup, redirecting...");
          setIsSetupComplete(true);
          window.location.href = "/welcome";
          return;
        }

        throw new Error(errorMessage);
      }

      // レスポンスの確認
      let responseData;
      try {
        responseData = await response.json();
        console.log("[Setup] Setup successful:", responseData);
      } catch (parseError) {
        // レスポンスが空でも成功として扱う
        console.warn("[Setup] Empty response from setup API:", parseError);
        responseData = null;
      }

      // セットアップ成功時はウェルカムページにリダイレクト
      console.log("[Setup] Redirecting to welcome page...");
      setIsSetupComplete(true);

      // router.pushが動作しない場合に備えて、window.location.hrefも使用
      try {
        router.push("/welcome");
        router.refresh();
        // リダイレクトが完了するまで少し待つ
        setTimeout(() => {
          if (window.location.pathname === "/setup") {
            console.warn(
              "[Setup] Router.push failed, using window.location.href",
            );
            window.location.href = "/welcome";
          }
        }, 500);
      } catch (redirectError) {
        console.error(
          "[Setup] Redirect error, using window.location.href:",
          redirectError,
        );
        window.location.href = "/welcome";
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "セットアップに失敗しました";
      console.error("[Setup] Error:", err);
      setError(errorMessage);
      isSubmittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  // バックアップステップの高さに合わせて、すべてのステップで同じ高さを維持
  const getCardHeight = () => {
    // バックアップステップのコンテンツ量に合わせた高さ
    // 説明文 + 要点リスト + 区切り線 + 保存先選択 + BACKUP_SECRET + 説明文 = 約550-600px
    // ヘッダー部分（約120px）+ フッター部分（約60px）+ パディング（約40px）を考慮
    return "h-[720px] max-h-[calc(100vh-2rem)]";
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center py-4">
      <div className="flex justify-center px-3">
        <div
          ref={cardRef}
          className={`bg-white rounded-lg p-5 ${getCardHeight()} flex flex-col w-[1029px] max-w-full`}
          style={
            backupMinHeight ? { minHeight: `${backupMinHeight}px` } : undefined
          }
        >
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-semibold text-slate-900">
              初回セットアップ
            </h1>
            <p className={descTextClass + " mt-0.5"}>
              必要事項を順に入力してください
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>
                  ステップ {step + 1}/{steps.length}
                </span>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              // 最終ステップ以外はEnterキーでのsubmitを防ぐ
              if (e.key === "Enter" && step !== STEP_POLICY) {
                e.preventDefault();
              }
            }}
            className="flex flex-1 flex-col min-h-0"
          >
            {error && (
              <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-3">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-5 grid flex-1 min-h-0 grid-cols-[220px,1fr] gap-5">
              <aside className="border-r border-slate-200 pr-3">
                <div className="grid grid-cols-[24px,1fr] gap-3">
                  <div className="relative">
                    <div className="absolute left-1/2 top-0 h-full w-2 -translate-x-1/2 rounded-full border border-slate-200 bg-slate-100" />
                    <div
                      className="absolute left-1/2 top-0 w-2 -translate-x-1/2 rounded-full bg-slate-900 transition-all duration-500"
                      style={{ height: progressFillHeight }}
                    />
                    <div
                      className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-slate-900"
                      style={{ top: progressIndicatorTop }}
                    />
                  </div>
                  <div className="space-y-1">
                    {steps.map((item, index) => {
                      const isActive = index === step;
                      const isComplete = index < step;
                      return (
                        <button
                          key={item.title}
                          type="button"
                          onClick={() => handleStepSelect(index)}
                          className={`w-full rounded-md px-2 py-2 text-left text-sm transition-colors ${
                            isActive
                              ? "bg-slate-100 text-slate-900"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                                isComplete
                                  ? "bg-slate-900 border-slate-900 text-white"
                                  : isActive
                                    ? "border-slate-900 text-slate-900"
                                    : "border-slate-200 text-slate-500"
                              }`}
                            >
                              {isComplete ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                index + 1
                              )}
                            </span>
                            <span className="font-medium">{item.title}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>

              <div className="flex min-h-0 flex-col">
                <div className="mb-3">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {steps[step].title}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {steps[step].description}
                  </p>
                </div>
                <div
                  className={`flex-1 min-h-0 pr-1 transition-all duration-300 ${
                    contentVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-1"
                  } ${step === STEP_BACKUP ? "flex items-center" : ""}`}
                >
                  {step === STEP_ENCRYPTION && (
                    <div className="space-y-2 pb-1">
                      <div className="space-y-3">
                        <p className={descTextClass}>
                          このアプリ内ではなく、PC本体のディスク暗号化を確認します。
                        </p>
                        <p className={descTextClass}>
                          端末紛失時でもデータが読まれないようにするために必要です。
                        </p>
                        <ul className="space-y-1 text-sm text-slate-600">
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                            MacはFileVault、WindowsはBitLockerをオンにする
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                            発行された復旧キーは安全な場所に保管する
                          </li>
                        </ul>
                        <div className="border-t border-slate-200" />
                        <div className="pt-1">
                          <DiskEncryptionGuide
                            variant="compact"
                            invalid={!!getFieldError("encryptionConfirmed")}
                            onConfirmedChange={(confirmed) => {
                              setEncryptionConfirmed(confirmed);
                              if (confirmed) {
                                clearFieldError("encryptionConfirmed");
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {step === STEP_SECURITY_OFFICER && (
                    <div className="space-y-3 pb-2">
                      <div className="space-y-3">
                        <p className={descTextClass}>
                          事故対応の責任者を明確にするため、安全管理責任者を登録します。
                        </p>
                        <p className={descTextClass}>
                          運用上の責任者です（ログイン用の管理者とは別です）。
                        </p>
                        <ul className="space-y-1 text-sm text-slate-600">
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                            事故発生時の連絡先として使用されます
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                            運用規程の承認責任者として機能します
                          </li>
                        </ul>
                        <div className="border-t border-slate-200" />
                        <div className="pt-1 space-y-3">
                          <div className="w-full space-y-3">
                            <div className="space-y-2">
                              <label
                                htmlFor="security-officer-role"
                                className="block text-sm font-medium text-slate-700 mb-1"
                              >
                                役職 <span className="text-red-500">*</span>
                              </label>
                              <Select
                                id="security-officer-role"
                                value={securityOfficerRolePreset}
                                onChange={(next) => {
                                  setSecurityOfficerRolePreset(next);
                                  if (next !== ROLE_CUSTOM_VALUE) {
                                    setSecurityOfficerRoleCustom("");
                                  }
                                  if (sameAsOfficer) {
                                    setAdminRolePreset(next);
                                    if (next !== ROLE_CUSTOM_VALUE) {
                                      setAdminRoleCustom("");
                                    }
                                    clearFieldError("adminRole");
                                  }
                                  clearFieldError("securityOfficerRole");
                                }}
                                options={[
                                  { value: "", label: "選択してください" },
                                  ...roleOptions,
                                ]}
                                placeholder="選択してください"
                                error={Boolean(
                                  getFieldError("securityOfficerRole"),
                                )}
                              />
                              {securityOfficerRolePreset ===
                                ROLE_CUSTOM_VALUE && (
                                <input
                                  id="security-officer-role-custom"
                                  type="text"
                                  required
                                  value={securityOfficerRoleCustom}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    setSecurityOfficerRoleCustom(next);
                                    if (sameAsOfficer) {
                                      setAdminRoleCustom(next);
                                      clearFieldError("adminRole");
                                    }
                                    clearFieldError("securityOfficerRole");
                                  }}
                                  className={getInputClassName(
                                    "securityOfficerRole",
                                  )}
                                  placeholder="例: 技術責任者"
                                />
                              )}
                            </div>
                            <div className="space-y-2">
                              <label
                                htmlFor="security-officer-last-name"
                                className="block text-sm font-medium text-slate-700 mb-1"
                              >
                                責任者名 <span className="text-red-500">*</span>
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label
                                    htmlFor="security-officer-last-name"
                                    className="block text-xs font-medium text-slate-500 mb-1"
                                  >
                                    姓
                                  </label>
                                  <input
                                    id="security-officer-last-name"
                                    type="text"
                                    required
                                    value={securityOfficerLastName}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      setSecurityOfficerLastName(next);
                                      clearFieldError(
                                        "securityOfficerLastName",
                                      );
                                      if (sameAsOfficer) {
                                        setAdminLastName(next);
                                        clearFieldError("adminLastName");
                                      }
                                    }}
                                    className={getInputClassName(
                                      "securityOfficerLastName",
                                    )}
                                    placeholder="例: 山田"
                                    autoComplete="family-name"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor="security-officer-first-name"
                                    className="block text-xs font-medium text-slate-500 mb-1"
                                  >
                                    名
                                  </label>
                                  <input
                                    id="security-officer-first-name"
                                    type="text"
                                    required
                                    value={securityOfficerFirstName}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      setSecurityOfficerFirstName(next);
                                      clearFieldError(
                                        "securityOfficerFirstName",
                                      );
                                      if (sameAsOfficer) {
                                        setAdminFirstName(next);
                                        clearFieldError("adminFirstName");
                                      }
                                    }}
                                    className={getInputClassName(
                                      "securityOfficerFirstName",
                                    )}
                                    placeholder="例: 太郎"
                                    autoComplete="given-name"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === STEP_ADMIN && (
                    <div className="space-y-3 pb-2">
                      <div className="space-y-3">
                        <div className="border-t border-slate-200" />
                        <div className="pt-1 space-y-3">
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sameAsOfficer}
                              onChange={(e) => {
                                const next = e.target.checked;
                                setSameAsOfficer(next);
                                if (next) {
                                  setAdminRolePreset(securityOfficerRolePreset);
                                  setAdminRoleCustom(securityOfficerRoleCustom);
                                  setAdminLastName(securityOfficerLastName);
                                  setAdminFirstName(securityOfficerFirstName);
                                  clearFieldError("adminRole");
                                  clearFieldError("adminLastName");
                                  clearFieldError("adminFirstName");
                                }
                              }}
                              className={getCheckboxClassName()}
                            />
                            <span className={descTextClass}>
                              安全管理責任者と当アプリ管理者を兼任する
                            </span>
                          </label>
                          <div className="w-full space-y-3">
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <label
                                  htmlFor="admin-role"
                                  className="block text-sm font-medium text-slate-700 mb-1"
                                >
                                  役職 <span className="text-red-500">*</span>
                                </label>
                                <Select
                                  id="admin-role"
                                  value={adminRolePreset}
                                  onChange={(next) => {
                                    setAdminRolePreset(next);
                                    if (next !== ROLE_CUSTOM_VALUE) {
                                      setAdminRoleCustom("");
                                    }
                                    clearFieldError("adminRole");
                                  }}
                                  disabled={sameAsOfficer}
                                  options={[
                                    { value: "", label: "選択してください" },
                                    ...roleOptions,
                                  ]}
                                  placeholder="選択してください"
                                  error={Boolean(getFieldError("adminRole"))}
                                />
                                {adminRolePreset === ROLE_CUSTOM_VALUE && (
                                  <input
                                    id="admin-role-custom"
                                    type="text"
                                    value={adminRoleCustom}
                                    onChange={(e) => {
                                      setAdminRoleCustom(e.target.value);
                                      clearFieldError("adminRole");
                                    }}
                                    required
                                    disabled={sameAsOfficer}
                                    className={`${getInputClassName("adminRole")} disabled:bg-slate-100`}
                                    placeholder="例: 技術責任者"
                                  />
                                )}
                              </div>
                              <div className="space-y-2">
                                <label
                                  htmlFor="admin-last-name"
                                  className="block text-sm font-medium text-slate-700 mb-1"
                                >
                                  管理者名{" "}
                                  <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label
                                      htmlFor="admin-last-name"
                                      className="block text-xs font-medium text-slate-500 mb-1"
                                    >
                                      姓
                                    </label>
                                    <input
                                      id="admin-last-name"
                                      type="text"
                                      value={adminLastName}
                                      onChange={(e) => {
                                        setAdminLastName(e.target.value);
                                        clearFieldError("adminLastName");
                                      }}
                                      required
                                      disabled={sameAsOfficer}
                                      className={`${getInputClassName("adminLastName")} disabled:bg-slate-100`}
                                      placeholder="例: 山田"
                                      autoComplete="family-name"
                                    />
                                  </div>
                                  <div>
                                    <label
                                      htmlFor="admin-first-name"
                                      className="block text-xs font-medium text-slate-500 mb-1"
                                    >
                                      名
                                    </label>
                                    <input
                                      id="admin-first-name"
                                      type="text"
                                      value={adminFirstName}
                                      onChange={(e) => {
                                        setAdminFirstName(e.target.value);
                                        clearFieldError("adminFirstName");
                                      }}
                                      required
                                      disabled={sameAsOfficer}
                                      className={`${getInputClassName("adminFirstName")} disabled:bg-slate-100`}
                                      placeholder="例: 太郎"
                                      autoComplete="given-name"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div>
                              <label
                                htmlFor="admin-email"
                                className="block text-sm font-medium text-slate-700 mb-1"
                              >
                                管理者ID <span className="text-red-500">*</span>
                              </label>
                              <input
                                id="admin-email"
                                type="text"
                                value={adminIdentifier}
                                onChange={(e) => {
                                  setAdminIdentifier(e.target.value);
                                  clearFieldError("adminIdentifier");
                                }}
                                required
                                className={getInputClassName("adminIdentifier")}
                                placeholder="例: 1234"
                                autoComplete="username"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label
                                  htmlFor="admin-password"
                                  className="block text-sm font-medium text-slate-700 mb-1"
                                >
                                  パスワード{" "}
                                  <span className="text-red-500">*</span>
                                </label>
                                <input
                                  id="admin-password"
                                  type="password"
                                  value={password}
                                  onChange={(e) => {
                                    setPassword(e.target.value);
                                    clearFieldError("adminPassword");
                                    clearFieldError("adminPasswordConfirm");
                                  }}
                                  required
                                  className={getInputClassName("adminPassword")}
                                  placeholder="例: 4321"
                                  autoComplete="new-password"
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="admin-password-confirm"
                                  className="block text-sm font-medium text-slate-700 mb-1"
                                >
                                  パスワード（確認）{" "}
                                  <span className="text-red-500">*</span>
                                </label>
                                <input
                                  id="admin-password-confirm"
                                  type="password"
                                  value={passwordConfirm}
                                  onChange={(e) => {
                                    setPasswordConfirm(e.target.value);
                                    clearFieldError("adminPasswordConfirm");
                                  }}
                                  required
                                  className={getInputClassName(
                                    "adminPasswordConfirm",
                                  )}
                                  placeholder="確認のため再入力"
                                  autoComplete="new-password"
                                />
                              </div>
                            </div>
                            <p className="text-sm font-semibold text-slate-900">
                              重要：このIDとパスワードはログイン時に毎回使用します。この後のログインでも必要です。
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === STEP_OPERATIONS && (
                    <div className="space-y-3 pb-2">
                      <OperationsConfirmation
                        invalid={!!getFieldError("operationsConfirmed")}
                        onConfirmedChange={(confirmed) => {
                          setOperationsConfirmed(confirmed);
                          if (confirmed) {
                            clearFieldError("operationsConfirmed");
                          }
                        }}
                      />
                    </div>
                  )}

                  {step === STEP_BACKUP && (
                    <div className="space-y-3 pb-2 w-full">
                      <BackupSettings
                        directory={backupDirectory}
                        source={backupSource}
                        externalAvailable={externalAvailable}
                        loading={backupLoading}
                        secret={backupSecret}
                        secretInvalid={!!getFieldError("backupSecret")}
                        onDirectoryChange={handleBackupDirectoryChange}
                        onDetectRequested={detectBackupLocation}
                        onSourceChange={handleBackupSourceChange}
                        onSecretChange={(value) => {
                          setBackupSecret(value);
                          if (value.trim().length >= 8) {
                            clearFieldError("backupSecret");
                          }
                        }}
                      />
                    </div>
                  )}

                  {step === STEP_RECOVERY && (
                    <div className="space-y-3 pb-2">
                      <div className="space-y-3">
                        <p className={descTextClass}>
                          管理者パスワードを忘れた場合の復旧に必要なコードです。必ず安全な場所に保管してください。
                        </p>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          管理者パスワードと復旧コードの両方を忘れると、施術録データを開くことは事実上困難になります。
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          管理者アカウントは1人のみ作成できます。
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                          <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-slate-900">
                              管理者復旧コード
                            </h3>
                            <p className="text-xs text-slate-600">
                              このコードがないとパスワードを再設定できません。
                            </p>
                          </div>
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center">
                            <div className="text-[11px] uppercase text-slate-500 tracking-widest">
                              Recovery Code
                            </div>
                            <div className="mt-2 font-mono text-sm tracking-[0.25em] text-slate-900 whitespace-nowrap">
                              {recoveryCode
                                ? formatRecoveryCode(recoveryCode)
                                : "生成中..."}
                            </div>
                            <div className="mt-3 flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={handleCopyRecoveryCode}
                                className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                コピー
                              </button>
                              {recoveryCopied && (
                                <span className="text-xs text-slate-500">
                                  コピーしました
                                </span>
                              )}
                            </div>
                          </div>
                          {getFieldError("recoveryCode") && (
                            <p className="text-xs text-rose-600">
                              {getFieldError("recoveryCode")}
                            </p>
                          )}
                          <label
                            className={`flex items-start gap-3 text-sm text-slate-700 ${
                              getFieldError("recoveryCodeConfirmed")
                                ? "bg-red-50/40 border border-red-200 rounded-lg px-3 py-2"
                                : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={recoveryCodeConfirmed}
                              onChange={(e) =>
                                setRecoveryCodeConfirmed(e.target.checked)
                              }
                              className={`mt-1 ${getCheckboxClassName(
                                !!getFieldError("recoveryCodeConfirmed"),
                              )}`}
                            />
                            <span className="block font-medium text-slate-800">
                              復旧コードを安全な場所に保存しました
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === STEP_POLICY && (
                    <div className="space-y-3 pb-2">
                      <div className="space-y-3">
                        <p className={descTextClass}>
                          サービス利用の前提条件として、プライバシーポリシーと利用規約への同意が必要です。
                        </p>
                        <div className="border-t border-slate-200" />
                        <div className="pt-1 space-y-3">
                          <div className="relative">
                            <div
                              ref={longDocRef}
                              className="h-80 overflow-y-auto rounded-md px-4 py-3 text-sm text-slate-700 space-y-4 border border-slate-200 bg-slate-50"
                            >
                              <section>
                                <h3 className="text-base font-semibold text-slate-900 mb-2">
                                  プライバシーポリシー
                                </h3>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  1. はじめに
                                </h4>
                                <p className="mb-2">
                                  柔道整復施術所向け電子施術録（以下「本アプリ」）は、柔道整復施術所向けの電子施術録アプリです。本プライバシーポリシーは、本アプリにおける情報の取扱いを説明します。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  2. 配布者情報
                                </h4>
                                <p className="mb-2">
                                  配布者名：田島京志郎
                                  <br />
                                  連絡先：vcharte378@gmail.com
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  3. 個人情報の取扱いについて
                                </h4>
                                <p className="mb-2">
                                  本アプリはローカル端末内で動作し、患者情報や管理情報を外部サービスへ送信しません。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  4. 端末内に保存される情報
                                </h4>
                                <p className="mb-2">
                                  初回セットアップ時に入力した責任者情報、管理者情報、バックアップ設定は端末内データベースに保存されます。
                                </p>
                                <p className="mb-2">
                                  <strong>重要</strong>
                                  ：患者名、電話番号、住所、診療内容などの個人を特定できる情報は端末外へ送信されません。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  5. 情報の使用方法
                                </h4>
                                <p className="mb-2">
                                  端末内に保存された情報は、施術録管理、認証、バックアップなど本アプリの機能提供のためにのみ使用されます。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  6. 情報の共有
                                </h4>
                                <p className="mb-2">
                                  本アプリ自体が外部送信を行うことはありません。データ共有が必要な場合は、利用者の運用判断でエクスポート等を実施してください。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  7. データの保存場所
                                </h4>
                                <p className="mb-2">
                                  本アプリはローカルで動作し、患者データは端末内に保存されます。配布者は患者データに直接アクセスすることはできません。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  8. セキュリティ対策
                                </h4>
                                <p className="mb-2">
                                  本アプリでは、AES-256-GCMによるデータ暗号化、アクセス制御、アクセスログの記録などのセキュリティ対策を実施しています。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  9. データの保存期間
                                </h4>
                                <p className="mb-2">
                                  端末内データの保存期間は、利用者の運用ポリシーおよび関連法令に従って管理してください。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  10. ユーザーの権利
                                </h4>
                                <p className="mb-2">
                                  端末内データに対する開示・訂正・削除の対応は、利用者自身の管理責任のもとで実施されます。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  11. 外部送信について
                                </h4>
                                <p className="mb-2">
                                  本OSS版は利用状況データの外部送信を行いません。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  12. お問い合わせ
                                </h4>
                                <p className="mb-2">
                                  プライバシーに関するお問い合わせは、配布者（田島京志郎）宛にご連絡ください：vcharte378@gmail.com
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  13. プライバシーポリシーの変更
                                </h4>
                                <p className="mb-2">
                                  本プライバシーポリシーは、予告なく変更される場合があります。変更内容は本ページで公開されます。重要な変更については、アプリ内で通知します。変更の適用時期は変更内容とともに本ページで明示します。
                                </p>
                              </section>
                              <section className="mt-4 pt-4 border-t border-slate-200">
                                <h3 className="text-base font-semibold text-slate-900 mb-2">
                                  利用規約
                                </h3>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  1. はじめに
                                </h4>
                                <p className="mb-2">
                                  本利用規約は、柔道整復施術所向け電子施術録（以下「本アプリ」）に適用される利用条件を定めるものです。配布者は田島京志郎です。本アプリをインストールまたは使用することで、本規約に同意したものとみなされます。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  2. サービスの提供
                                </h4>
                                <p className="mb-2">
                                  本アプリはElectronアプリとして提供されます。無償提供のため、配布者は予告なく提供を終了できるものとします。更新の提供を保証するものではありません。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  3. 禁止行為
                                </h4>
                                <p className="mb-2">
                                  利用者は、以下の行為を行ってはなりません：
                                </p>
                                <ul className="list-disc list-inside space-y-1 ml-2 mb-2">
                                  <li>本アプリの再配布、転売、レンタル</li>
                                  <li>本アプリの改変</li>
                                  <li>
                                    本アプリのリバースエンジニアリング（法令で認められる範囲を除く）
                                  </li>
                                </ul>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  4. 利用者の責任
                                </h4>
                                <p className="mb-2">
                                  利用者は、以下の責任を負います：
                                </p>
                                <ul className="list-disc list-inside space-y-1 ml-2 mb-2">
                                  <li>
                                    患者情報の適切な管理とセキュリティ対策
                                  </li>
                                  <li>データのバックアップおよびデータ復旧</li>
                                  <li>法令遵守（個人情報保護法、医療法等）</li>
                                  <li>本アプリの適切な使用</li>
                                </ul>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  5. 知的財産権
                                </h4>
                                <p className="mb-2">
                                  本アプリおよび同梱物の知的財産権は配布者に帰属します。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  6. 情報の取扱い
                                </h4>
                                <p className="mb-2">
                                  本アプリは初回セットアップ時に責任者情報を端末内に保存します。利用者データは端末内で管理され、外部サービスへ自動送信されません。詳細はプライバシーポリシーを参照してください。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  7. 医療情報システム
                                </h4>
                                <p className="mb-2">
                                  本アプリは「医療情報システムの安全管理に関するガイドライン」を参照して設計されており、利用者が同ガイドラインに沿った運用を行うことを前提とします。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  8. 免責事項
                                </h4>
                                <p className="mb-2">
                                  本アプリは「現状のまま」提供され、以下の事項について一切の責任を負いません：
                                </p>
                                <ul className="list-disc list-inside space-y-1 ml-2 mb-2">
                                  <li>データの損失、破損、漏洩</li>
                                  <li>システムの不具合や障害</li>
                                  <li>
                                    利用者による不適切な使用に起因する損害
                                  </li>
                                  <li>
                                    本アプリを使用したことによる直接的・間接的な損害
                                  </li>
                                  <li>
                                    医療行為・診療記録の正確性に関する事項
                                  </li>
                                </ul>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  9. システム障害時の対応
                                </h4>
                                <p className="mb-2">
                                  システム障害時は配布者に連絡できますが、対応を保証するものではありません。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  10. 契約の終了
                                </h4>
                                <p className="mb-2">
                                  利用者はいつでも利用を停止でき、配布者は予告なく提供を終了できます。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  11. 準拠法
                                </h4>
                                <p className="mb-2">
                                  本規約は日本法に準拠します。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  12. 規約の変更
                                </h4>
                                <p className="mb-2">
                                  本規約は、予告なく変更される場合があります。変更内容は本ページで公開されます。重要な変更については、アプリ内で通知します。変更の適用時期は変更内容とともに本ページで明示します。
                                </p>
                                <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1">
                                  13. お問い合わせ
                                </h4>
                                <p className="mb-2">
                                  本規約に関するお問い合わせは、配布者（田島京志郎）宛にご連絡ください：vcharte378@gmail.com
                                </p>
                              </section>
                            </div>
                            {!longDocReady && (
                              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none flex items-end justify-center pb-2">
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                  <svg
                                    className="w-4 h-4 animate-bounce"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                    />
                                  </svg>
                                  <span>スクロールして続きを読む</span>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="mt-4 space-y-2">
                            {!longDocReady && (
                              <p className="text-xs text-slate-500">
                                最後までスクロールすると、自動的にチェックが有効になります。
                              </p>
                            )}
                            {longDocReady && (
                              <p className="text-xs text-slate-600 font-medium">
                                ✓ 最後まで読み終わりました
                              </p>
                            )}
                            <label
                              className={`flex items-start gap-3 text-sm text-slate-700 ${
                                getFieldError("longDocConfirmed")
                                  ? "bg-red-50/40 border border-red-200 rounded-md px-2 py-1"
                                  : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={longDocReady}
                                onChange={(e) => {
                                  if (e.target.checked && !longDocReady) {
                                    if (longDocRef.current) {
                                      longDocRef.current.scrollTop =
                                        longDocRef.current.scrollHeight;
                                    }
                                  }
                                }}
                                disabled={!longDocReady}
                                className={`mt-1 ${getCheckboxClassName(
                                  !!getFieldError("longDocConfirmed"),
                                )} disabled:opacity-50`}
                              />
                              <span className="block font-medium text-slate-800">
                                プライバシーポリシーおよび利用規約に同意します
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between pt-3 flex-shrink-0 border-t border-slate-200">
              <button
                type="button"
                onClick={handleBack}
                disabled={step === 0 || loading}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-slate-400 focus-visible:outline-offset-1"
              >
                <ChevronLeft className="h-4 w-4" />
                戻る
              </button>
              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-slate-400 focus-visible:outline-offset-1"
                >
                  次へ
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || !longDocConfirmed}
                  className="flex items-center gap-2 rounded-md bg-slate-900 px-6 py-2 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-slate-400 focus-visible:outline-offset-1"
                >
                  {loading ? "セットアップ中..." : "セットアップを完了"}
                  {!loading && <Check className="h-4 w-4" />}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
