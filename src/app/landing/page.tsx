import { notFound } from "next/navigation";
import LandingClient from "./LandingClient";

const isElectronBuild = process.env.ELECTRON_BUILD === "true";
const isElectronRuntime = process.env.ELECTRON_RUNTIME === "true";

export default function LandingPage() {
  if (isElectronBuild || isElectronRuntime) {
    notFound();
  }

  return <LandingClient />;
}
