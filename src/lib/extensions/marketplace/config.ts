import "server-only";

export const MARKETPLACE_CONFIG = {
  apiUrl: process.env.EXTENSION_MARKETPLACE_API_URL || "",
  apiKey: process.env.EXTENSION_MARKETPLACE_API_KEY || "",
};
