"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type Patient = {
  id: string;
  lastName: string;
  firstName: string;
  lastKana: string;
  firstKana: string;
  birthDate: Date | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  postalCode: string | null;
  prefecture: string | null;
  city: string | null;
  address1: string | null;
  address2: string | null;
  patientNumber: string | null;
  memo: string | null;
};

const PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
];

export function PatientForm({
  patient,
  onSuccess,
}: {
  patient?: Patient;
  onSuccess?: (
    updatedPatient: any,
    options?: { createChart?: boolean },
  ) => void;
}) {
  const fieldBaseClass =
    "w-full h-9 px-3 py-2 rounded-md border-2 focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all hover:border-slate-400";
  const textareaBaseClass =
    "w-full px-3 py-2 rounded-md border-2 focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all hover:border-slate-400";
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [birthDate, setBirthDate] = useState<string>(
    patient?.birthDate
      ? new Date(patient.birthDate).toISOString().split("T")[0]
      : "",
  );
  const [postalCode, setPostalCode] = useState<string>(
    patient?.postalCode || "",
  );
  const [prefecture, setPrefecture] = useState<string>(
    patient?.prefecture || "",
  );
  const [city, setCity] = useState<string>(patient?.city || "");
  const [address1, setAddress1] = useState<string>(patient?.address1 || "");
  const [address2, setAddress2] = useState<string>(patient?.address2 || "");
  const [gender, setGender] = useState<string>(patient?.gender || "");
  const [createChartAfterSave, setCreateChartAfterSave] =
    useState<boolean>(true);

  useEffect(() => {
    setGender(patient?.gender || "");
  }, [patient?.gender]);
  const getFieldError = (key: string) => fieldErrors[key];
  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
  const getFieldClassName = (key?: string) =>
    `${fieldBaseClass} ${
      key && getFieldError(key)
        ? "border-red-500 bg-red-50/40 focus:border-slate-500"
        : "border-slate-300 bg-white focus:border-slate-500"
    }`;
  const getTextareaClassName = (key?: string) =>
    `${textareaBaseClass} ${
      key && getFieldError(key)
        ? "border-red-500 bg-red-50/40 focus:border-slate-500"
        : "border-slate-300 bg-white focus:border-slate-500"
    }`;

  const formatDateInput = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return "";

    // 区切りを統一
    const normalized = trimmed
      .replace(/\s+/g, "")
      .replace(/\./g, "-")
      .replace(/\//g, "-");

    // 西暦入力のみ許可（yyyy-mm-dd / yyyymmdd）
    const yyyyMatch = normalized.match(
      /^(\d{4})(?:[-/]?(\d{2})(?:[-/]?(\d{2}))?)?$/,
    );
    if (yyyyMatch) {
      const y = yyyyMatch[1];
      const m = yyyyMatch[2];
      const d = yyyyMatch[3];
      if (m && d) return `${y}-${m}-${d}`;
      if (m && !d) return `${y}-${m}-01`;
      return normalized;
    }

    // 不明形式はそのまま返す（ブラウザバリデーションに委ねる）
    return input;
  };

  const isKatakanaOnly = (input: string) => {
    const value = input.trim();
    if (!value) return true;
    return /^[ァ-ヶー\s]+$/.test(value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const normalize = (value: FormDataEntryValue | null) =>
      value ? String(value).trim() : null;

    const errors: Record<string, string> = {};
    const requiredPatientNumber = normalize(formData.get("patientNumber"));
    const requiredLastName = normalize(formData.get("lastName"));
    const requiredFirstName = normalize(formData.get("firstName"));
    const requiredLastKana = normalize(formData.get("lastKana"));
    const requiredFirstKana = normalize(formData.get("firstKana"));

    if (!requiredPatientNumber) errors.patientNumber = "IDを入力してください";
    if (!requiredLastName) errors.lastName = "姓を入力してください";
    if (!requiredFirstName) errors.firstName = "名を入力してください";
    if (!requiredLastKana) errors.lastKana = "セイを入力してください";
    if (!requiredFirstKana) errors.firstKana = "メイを入力してください";
    if (requiredLastKana && !isKatakanaOnly(requiredLastKana)) {
      errors.lastKana = "フリガナは全角カタカナで入力してください";
    }
    if (requiredFirstKana && !isKatakanaOnly(requiredFirstKana)) {
      errors.firstKana = "フリガナは全角カタカナで入力してください";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    const data = {
      lastName: requiredLastName || "",
      firstName: requiredFirstName || "",
      lastKana: requiredLastKana || "",
      firstKana: requiredFirstKana || "",
      birthDate: birthDate ? birthDate : null,
      gender: gender || null,
      phone: normalize(formData.get("phone")) || null,
      email: normalize(formData.get("email")) || null,
      postalCode: postalCode.trim() || null,
      prefecture: prefecture.trim() || null,
      city: city.trim() || null,
      address1: address1.trim() || null,
      address2: address2.trim() || null,
      patientNumber: requiredPatientNumber || null,
      memo: normalize(formData.get("memo")) || null,
    };

    try {
      const url = patient ? `/api/patients/${patient.id}` : "/api/patients";
      const method = patient ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "保存に失敗しました");
      }

      const result = await response.json();
      if (onSuccess) {
        onSuccess(result, { createChart: createChartAfterSave });
      } else if (patient) {
        router.push(`/patients/${result.id}`);
        router.refresh();
      } else {
        if (createChartAfterSave) {
          router.push(`/patients/${result.id}/charts/new`);
        } else {
          router.push(`/patients/${result.id}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存に失敗しました";
      if (message.includes("患者ID") || message.includes("ID")) {
        setFieldErrors((prev) => ({
          ...prev,
          patientNumber: message,
        }));
      } else {
        setFormError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = patient ? "保存" : "登録する";
  const submittingLabel = patient ? "保存中..." : "登録中...";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-1">
      <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">基本情報</div>
          <div className="text-xs text-slate-500">* 必須</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <label
              htmlFor="patientNumber"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              ID <span className="text-red-500">*</span>
            </label>
            <input
              id="patientNumber"
              name="patientNumber"
              type="text"
              defaultValue={patient?.patientNumber || ""}
              required
              onChange={() => clearFieldError("patientNumber")}
              className={getFieldClassName("patientNumber")}
              aria-invalid={!!getFieldError("patientNumber")}
            />
            <p className="mt-1 min-h-[0.75rem] text-xs text-red-600">
              {getFieldError("patientNumber") || ""}
            </p>
          </div>

          <div className="md:col-span-4">
            <label
              htmlFor="birthDate"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              生年月日
            </label>
            <input
              id="birthDate"
              name="birthDate"
              type="date"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              value={birthDate}
              onChange={(e) => setBirthDate(formatDateInput(e.target.value))}
              className={`${getFieldClassName()} text-slate-900`}
              spellCheck={false}
              autoComplete="bday"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              性別
            </label>
            <input type="hidden" name="gender" value={gender} />
            <div
              className="inline-flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1"
              role="group"
              aria-label="性別"
            >
              {[
                { value: "男性", label: "男性" },
                { value: "女性", label: "女性" },
              ].map((option) => {
                const active = gender === option.value;
                return (
                  <button
                    key={option.value || "empty"}
                    type="button"
                    onClick={() =>
                      setGender((prev) =>
                        prev === option.value ? "" : option.value,
                      )
                    }
                    className={`h-7 rounded-md px-3 text-sm transition-colors ${
                      active
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                    }`}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-12">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              氏名 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  id="lastName"
                  name="lastName"
                  placeholder="姓"
                  required
                  defaultValue={patient?.lastName || ""}
                  onChange={() => clearFieldError("lastName")}
                  className={getFieldClassName("lastName")}
                  aria-invalid={!!getFieldError("lastName")}
                />
                <p className="mt-1 min-h-[0.75rem] text-xs text-red-600">
                  {getFieldError("lastName") || ""}
                </p>
              </div>
              <div>
                <input
                  id="firstName"
                  name="firstName"
                  placeholder="名"
                  required
                  defaultValue={patient?.firstName || ""}
                  onChange={() => clearFieldError("firstName")}
                  className={getFieldClassName("firstName")}
                  aria-invalid={!!getFieldError("firstName")}
                />
                <p className="mt-1 min-h-[0.75rem] text-xs text-red-600">
                  {getFieldError("firstName") || ""}
                </p>
              </div>
            </div>
          </div>

          <div className="md:col-span-12">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              フリガナ <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  id="lastKana"
                  name="lastKana"
                  placeholder="セイ"
                  required
                  defaultValue={patient?.lastKana || ""}
                  onChange={() => clearFieldError("lastKana")}
                  className={getFieldClassName("lastKana")}
                  aria-invalid={!!getFieldError("lastKana")}
                />
                <p className="mt-1 min-h-[0.75rem] text-xs text-red-600">
                  {getFieldError("lastKana") || ""}
                </p>
              </div>
              <div>
                <input
                  id="firstKana"
                  name="firstKana"
                  placeholder="メイ"
                  required
                  defaultValue={patient?.firstKana || ""}
                  onChange={() => clearFieldError("firstKana")}
                  className={getFieldClassName("firstKana")}
                  aria-invalid={!!getFieldError("firstKana")}
                />
                <p className="mt-1 min-h-[0.75rem] text-xs text-red-600">
                  {getFieldError("firstKana") || ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <details className="group rounded-xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-2 text-sm font-semibold text-slate-700">
          詳細（任意）
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label
                htmlFor="phone"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                電話番号
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="090-1234-5678"
                defaultValue={patient?.phone || ""}
                className={getFieldClassName()}
              />
            </div>

            <div className="md:col-span-6">
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={patient?.email || ""}
                className={getFieldClassName()}
              />
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="postalCode"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                郵便番号
              </label>
              <input
                id="postalCode"
                name="postalCode"
                type="text"
                placeholder="123-4567"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                onBlur={async () => {
                  const digits = postalCode.replace(/\D/g, "");
                  if (!/^\d{7}$/.test(digits)) return;
                  try {
                    const res = await fetch(
                      `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`,
                    );
                    const json = await res.json();
                    if (json?.status === 200 && json.results?.[0]) {
                      const r = json.results[0];
                      setPrefecture(r.address1 || "");
                      setCity(`${r.address2 || ""}${r.address3 || ""}`);
                      // address1は丁目以降を入力できるよう空で残す
                    }
                  } catch {
                    // 失敗時は何もしない
                  }
                }}
                className={getFieldClassName()}
              />
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="prefecture"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                都道府県
              </label>
              <select
                id="prefecture"
                name="prefecture"
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                className={getFieldClassName()}
              >
                <option value="">選択してください</option>
                {PREFECTURES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="city"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                市区町村
              </label>
              <input
                id="city"
                name="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={getFieldClassName()}
              />
            </div>

            <div className="md:col-span-12">
              <label
                htmlFor="address1"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                町名・番地
              </label>
              <input
                id="address1"
                name="address1"
                type="text"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                className={getFieldClassName()}
              />
            </div>

            <div className="md:col-span-12">
              <label
                htmlFor="address2"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                建物名・部屋番号
              </label>
              <input
                id="address2"
                name="address2"
                type="text"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
                className={getFieldClassName()}
              />
            </div>

            <div className="md:col-span-12">
              <label
                htmlFor="memo"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                メモ
              </label>
              <textarea
                id="memo"
                name="memo"
                rows={3}
                defaultValue={patient?.memo || ""}
                className={getTextareaClassName()}
              />
            </div>
          </div>
        </div>
      </details>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          {formError ? (
            <p className="text-sm text-red-600">{formError}</p>
          ) : (
            <span />
          )}
          {!patient && (
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                id="create-chart-after-save"
                type="checkbox"
                checked={createChartAfterSave}
                onChange={(e) => setCreateChartAfterSave(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              そのまま作成した患者にカルテを作成する
            </label>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" onClick={() => router.back()}>
            キャンセル
          </Button>
          <Button
            type="submit"
            size="md"
            loading={loading}
            loadingText={submittingLabel}
          >
            {submitLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
