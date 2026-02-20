import { defineConfig } from "@prisma/config";
import { config } from "dotenv";

// 環境変数を読み込む
config();

export default defineConfig({
  schema: "./prisma/schema.prisma",
});
