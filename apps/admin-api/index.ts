// Entry for Hono Worker: admin-api
export default {
  fetch(request, env, ctx) {
    return new Response('Hello from admin-api!');
  }
}
