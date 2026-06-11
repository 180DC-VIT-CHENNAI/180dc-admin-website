function addSecurityHeaders(headers: Headers) {
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com https://*.clerk.accounts.dev; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://180dc.org https://static.cloudflareinsights.com; connect-src 'self' https://*.180dc.org https://*.180dc.shop https://admin-api.technical-vitc.workers.dev wss://admin-api.technical-vitc.workers.dev https://raw.githubusercontent.com https://gist.githubusercontent.com https://cloudflareinsights.com https://*.clerk.accounts.dev; font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://*.clerk.accounts.dev; worker-src 'self' blob: https://*.clerk.accounts.dev; frame-ancestors 'none'; base-uri 'self'",
  );
  headers.set("X-XSS-Protection", "0");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
}

const API_BASE = "https://admin-api.technical-vitc.workers.dev";

export async function onRequest(context: any) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Proxy API requests to the admin-api worker
  if (path.startsWith("/api/")) {
    const apiUrl = new URL(path, API_BASE);
    apiUrl.search = url.search;
    const apiHeaders = new Headers(request.headers);
    apiHeaders.delete("X-Content-Type-Options");
    const apiResponse = await fetch(apiUrl.toString(), {
      method: request.method,
      headers: apiHeaders,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    });
    const respHeaders = new Headers(apiResponse.headers);
    addSecurityHeaders(respHeaders);
    return new Response(apiResponse.body, {
      status: apiResponse.status,
      statusText: apiResponse.statusText,
      headers: respHeaders,
    });
  }

  if (path.startsWith("/assets/") || path === "/favicon.svg" || path === "/icons.svg") {
    const response = await next();
    if (path.endsWith(".js") || path.endsWith(".mjs")) {
      response.headers.set("Content-Type", "text/javascript");
    }
    addSecurityHeaders(response.headers);
    return response;
  }

  const response = await next();

  if (response.status === 404) {
    const index = await env.ASSETS.fetch(new URL("/index.html", url.origin));
    const newResponse = new Response(index.body, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    addSecurityHeaders(newResponse.headers);
    return newResponse;
  }

  addSecurityHeaders(response.headers);
  return response;
}
