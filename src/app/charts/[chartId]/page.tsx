import { notFound } from "next/navigation";
import { headers, cookies } from "next/headers";
import {
  ChartDetailView,
  ChartDetailPayload,
} from "@/components/charts/ChartDetailView";

async function fetchChartDetail(
  chartId: string,
): Promise<ChartDetailPayload | null> {
  const baseUrl = (() => {
    if (process.env.NEXT_PUBLIC_BASE_URL)
      return process.env.NEXT_PUBLIC_BASE_URL;
    const headerStore = headers();
    const proto = headerStore.get("x-forwarded-proto") ?? "http";
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    return host ? `${proto}://${host}` : "http://localhost:3000";
  })();
  const res = await fetch(`${baseUrl}/api/charts/${chartId}/detail`, {
    cache: "no-store",
    headers: {
      cookie: cookies().toString(),
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as ChartDetailPayload;
}

export default async function ChartDetailPage({
  params,
  searchParams,
}: {
  params: { chartId: string };
  searchParams: { returnTo?: string; recordsReturnTo?: string };
}) {
  const chart = await fetchChartDetail(params.chartId);
  if (!chart) notFound();

  const backHref = searchParams.returnTo || "/charts";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <ChartDetailView chart={chart} backHref={backHref} />
      </div>
    </main>
  );
}
