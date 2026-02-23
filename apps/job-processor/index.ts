// Entry for Queue consumer Worker: job-processor
export default {
  async queue(batch, env, ctx) {
    // Process jobs here
    return { success: true };
  }
}
