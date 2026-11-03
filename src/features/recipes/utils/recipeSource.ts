export type RecipeSourceType = "manual" | "youtube" | "instagram";

export type ParsedRecipeSource = {
  sourceType: RecipeSourceType;
  sourceUrl: string | null;
};

/**
 * YouTube / Instagram のURLを判定し、
 * 保存用のURLへ正規化する。
 *
 * 対応:
 * - YouTube 通常動画
 * - YouTube Shorts
 * - youtu.be
 * - Instagram 投稿
 * - Instagram Reel
 *
 * URLなし:
 * - manual
 *
 * 未対応URL・埋め込みHTML:
 * - null
 */
export function parseRecipeSource(
  input?: string | null,
): ParsedRecipeSource | null {
  const value = input?.trim();

  if (!value) {
    return {
      sourceType: "manual",
      sourceUrl: null,
    };
  }

  // Instagramなどの埋め込みHTMLは登録対象外
  if (value.startsWith("<") || value.includes("<blockquote")) {
    return null;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname;

    /* ===============================
       YouTube
    ============================== */

    if (hostname === "youtu.be") {
      const videoId = pathname.split("/").filter(Boolean)[0];

      if (!videoId) return null;

      return {
        sourceType: "youtube",
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };
    }

    const isYoutube =
      hostname === "youtube.com" || hostname.endsWith(".youtube.com");

    if (isYoutube) {
      // 通常動画
      if (pathname === "/watch") {
        const videoId = url.searchParams.get("v");

        if (!videoId) return null;

        return {
          sourceType: "youtube",
          sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
        };
      }

      // Shorts
      if (pathname.startsWith("/shorts/")) {
        const videoId = pathname.split("/").filter(Boolean)[1];

        if (!videoId) return null;

        return {
          sourceType: "youtube",
          sourceUrl: `https://www.youtube.com/shorts/${videoId}`,
        };
      }

      // 既存のembed URL互換
      if (pathname.startsWith("/embed/")) {
        const videoId = pathname.split("/").filter(Boolean)[1];

        if (!videoId) return null;

        return {
          sourceType: "youtube",
          sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
        };
      }

      return null;
    }

    /* ===============================
       Instagram
    ============================== */

    const isInstagram =
      hostname === "instagram.com" || hostname.endsWith(".instagram.com");

    if (isInstagram) {
      const parts = pathname.split("/").filter(Boolean);

      if (parts.length < 2) {
        return null;
      }

      const contentType = parts[0];
      const shortcode = parts[1];

      // βでは投稿とReelのみ対応
      if (contentType !== "p" && contentType !== "reel") {
        return null;
      }

      if (!shortcode) {
        return null;
      }

      return {
        sourceType: "instagram",
        sourceUrl: `https://www.instagram.com/${contentType}/${shortcode}/`,
      };
    }

    return null;
  } catch {
    return null;
  }
}
