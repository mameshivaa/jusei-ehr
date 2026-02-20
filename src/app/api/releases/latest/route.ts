import { NextResponse } from "next/server";

const GITHUB_OWNER = "mameshivaa";
const GITHUB_REPO = "v-oss";

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

export async function GET() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
        next: { revalidate: 3600 }, // 1時間キャッシュ
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch latest release" },
        { status: response.status },
      );
    }

    const release: GitHubRelease = await response.json();

    // プラットフォーム別のアセットを分類
    const assets = {
      mac: release.assets.find(
        (asset) =>
          asset.name.includes(".dmg") ||
          (asset.name.includes(".zip") && asset.name.includes("mac")),
      ),
      windows: release.assets.find(
        (asset) =>
          asset.name.includes(".exe") ||
          asset.name.includes(".nsis") ||
          (asset.name.includes(".zip") && asset.name.includes("win")),
      ),
      linux: release.assets.find(
        (asset) =>
          asset.name.includes(".AppImage") ||
          asset.name.includes(".deb") ||
          (asset.name.includes(".zip") && asset.name.includes("linux")),
      ),
    };

    return NextResponse.json({
      version: release.tag_name.replace(/^v/, ""),
      name: release.name,
      publishedAt: release.published_at,
      assets,
      releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${release.tag_name}`,
    });
  } catch (error) {
    console.error("Error fetching latest release:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
