// Entry for Hono Worker: public-api
export default {
  fetch(request, env, ctx) {
    return new Response('Hello from public-api!');
  }
}
