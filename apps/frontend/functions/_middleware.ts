export async function onRequest(context: any) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.startsWith("/assets/") || path === "/favicon.svg" || path === "/icons.svg") {
    return next();
  }

  const response = await next();

  if (response.status === 404) {
    const index = await env.ASSETS.fetch(new URL("/index.html", url.origin));
    return new Response(index.body, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }

  return response;
}
