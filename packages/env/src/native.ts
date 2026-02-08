import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "EXPO_PUBLIC_",
  client: {
    EXPO_PUBLIC_CONVEX_URL: z.url(),
    EXPO_PUBLIC_HEALTH_API_BASE_URL: z.url(),
    EXPO_PUBLIC_HEALTH_API_TOKEN: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
