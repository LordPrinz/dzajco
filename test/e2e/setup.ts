import { beforeAll } from "bun:test";
import { warmUp } from "./helpers";

// Preloaded by `test:e2e`: launch the browser once before any test, so the first one does not wait for it.
beforeAll(warmUp);
