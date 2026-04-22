import { z } from "zod";

export const trackEventSchema = z.object({
  eventName: z
    .string("Event name is required")
    .min(1, "Event name is required"),

  url: z.string("A valid url is required"),

  userId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// This creates a TypeScript type from our schema for type safety
export type TrackEventInput = z.infer<typeof trackEventSchema>;
