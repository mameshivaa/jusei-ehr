import Link from "next/link";
import { differenceInYears, format } from "date-fns";
import { ja } from "date-fns/locale";

type Patient = {
  id: string;
  name: string;
  kana: string | null;
  birthDate: Date | null;
  patientNumber: string | null;
  lastVisit: Date | null;
  chartsCount: number | null;
  injuriesCount: number | null;
  visitsCount: number | null;
};

export function PatientList({ patients }: { patients: Patient[] }) {
  if (patients.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-slate-600">患者が見つかりませんでした</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              ID / 患者ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              氏名 / フリガナ
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              年齢
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              最終来院
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              C / V / I
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {patients.map((patient) => (
            <tr key={patient.id} className="hover:bg-slate-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-700">
                {patient.patientNumber || patient.id}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                <div className="font-medium text-slate-900">{patient.name}</div>
                <div className="text-xs text-slate-500">
                  {patient.kana || "—"}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {patient.birthDate
                  ? `${differenceInYears(new Date(), new Date(patient.birthDate))}歳`
                  : "—"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {patient.lastVisit
                  ? format(new Date(patient.lastVisit), "yyyy/MM/dd", {
                      locale: ja,
                    })
                  : "—"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right tabular-nums">
                {patient.chartsCount ?? "—"} / {patient.visitsCount ?? "—"} /{" "}
                {patient.injuriesCount ?? "—"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link
                  href={`/patients/${patient.id}`}
                  className="text-slate-600 hover:text-slate-900"
                >
                  詳細
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
