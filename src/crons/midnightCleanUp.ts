export const cronExpression = "0 0 * * *";

export async function handler(env: Env) {
  // Example logic (e.g. database purge or hitting an endpoint)
  console.log("Cleaning up expired database sessions...", { env });
}
