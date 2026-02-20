import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PatientForm } from "@/components/patients/PatientForm";

export default async function NewPatientPage() {
  await requireAuth();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">新規患者登録</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <PatientForm />
        </div>
      </div>
    </main>
  );
}
