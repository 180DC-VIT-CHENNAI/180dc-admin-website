function addSecurityHeaders(headers: Headers) {
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://180dc.org; connect-src 'self' https://*.180dc.org https://admin-api.technical-vitc.workers.dev; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'self'",
  );
  headers.set("X-XSS-Protection", "0");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
}

export async function onRequest(context: any) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.startsWith("/assets/") || path === "/favicon.svg" || path === "/icons.svg") {
    const response = await next();
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
