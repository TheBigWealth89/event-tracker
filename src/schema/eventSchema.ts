import { z } from "zod";

export const trackEventSchema = z.object({
  body: z.object({
    eventName: z.string().min(1, { message: "Event name is required" }),

    url: z.string({ message: "A valid url is required" }),
  }),
  userId: z.string().optional(),
});
