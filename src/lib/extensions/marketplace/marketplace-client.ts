import "server-only";

import { MARKETPLACE_CONFIG } from "./config";
import type { CatalogExtension } from "./types";

function getHeaders(): Record<string, string> {
  if (!MARKETPLACE_CONFIG.apiKey) {
    return {};
  }
  return {
    Authorization: `Bearer ${MARKETPLACE_CONFIG.apiKey}`,
  };
}

function ensureConfig() {
  if (!MARKETPLACE_CONFIG.apiUrl) {
    throw new Error("Marketplace API URL is not configured");
  }
  if (!MARKETPLACE_CONFIG.apiKey) {
    throw new Error("Marketplace API key is not configured");
  }
}

export async function fetchCatalog(): Promise<CatalogExtension[]> {
  ensureConfig();
  const response = await fetch(
    `${MARKETPLACE_CONFIG.apiUrl}/api/v1/extensions`,
    {
      headers: {
        "Content-Type": "application/json",
        ...getHeaders(),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch catalog");
  }

  return (await response.json()) as CatalogExtension[];
}

export async function fetchCatalogItem(id: string): Promise<CatalogExtension> {
  ensureConfig();
  const response = await fetch(
    `${MARKETPLACE_CONFIG.apiUrl}/api/v1/extensions/${encodeURIComponent(id)}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...getHeaders(),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch catalog item");
  }

  return (await response.json()) as CatalogExtension;
}

export async function downloadExtensionPackage(
  id: string,
  version?: string,
): Promise<{ buffer: Buffer; packageHash: string; signature: string }> {
  ensureConfig();
  const url = new URL(
    `${MARKETPLACE_CONFIG.apiUrl}/api/v1/extensions/${encodeURIComponent(id)}/download`,
  );
  if (version) {
    url.searchParams.set("version", version);
  }

  const response = await fetch(url.toString(), {
    headers: {
      ...getHeaders(),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to download extension package");
  }

  const packageHash = response.headers.get("x-package-hash");
  const signature = response.headers.get("x-signature");
  if (!packageHash || !signature) {
    throw new Error("Missing package integrity headers");
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    packageHash,
    signature,
  };
}
