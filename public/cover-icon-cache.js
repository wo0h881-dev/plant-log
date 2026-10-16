(function (scope) {
  const notionHost = "prod-files-secure.s3.us-west-2.amazonaws.com";

  function keyFor(requestUrl, origin) {
    try {
      const request = new URL(requestUrl, origin);
      const width = Number(request.searchParams.get("w"));
      if (request.origin !== origin || request.pathname !== "/_next/image" || request.searchParams.get("cover_icon") !== "1" || ![32, 48, 64, 96, 128, 144].includes(width)) return;
      const source = new URL(request.searchParams.get("url"), origin);
      if (source.origin !== origin && (source.protocol !== "https:" || source.hostname !== notionHost || source.port)) return;
      if (source.hostname === notionHost) {
        for (const key of [...source.searchParams.keys()]) {
          if (key.toLowerCase().startsWith("x-amz-") || ["awsaccesskeyid", "signature", "expires"].includes(key.toLowerCase())) source.searchParams.delete(key);
        }
      }
      source.hash = "";
      source.searchParams.sort();
      const cacheKey = new URL("/__cover_icon_cache__", origin);
      cacheKey.search = new URLSearchParams({ asset: source.href, w: String(width), q: request.searchParams.get("q") || "75" }).toString();
      return cacheKey.href;
    } catch { return; }
  }
  scope.PlantCoverIconCache = { keyFor };
})(globalThis);
