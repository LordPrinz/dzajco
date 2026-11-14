import type { RequestIdVariables } from "../middleware/request-id";
import type { NonceVariables } from "../middleware/security-headers";

/** Hono env of the root app: Worker bindings plus the variables the global middleware sets. */
export type AppEnv = {
  Bindings: Cloudflare.Env;
  Variables: RequestIdVariables & NonceVariables;
};
