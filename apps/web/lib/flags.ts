import { createFlagsClient } from "@coreberg/observability";
import { createClient } from "@/lib/supabase/client";

let cached: ReturnType<typeof createFlagsClient> | null = null;

export function flags() {
  if (!cached) {
    cached = createFlagsClient(createClient() as any);
  }
  return cached;
}
