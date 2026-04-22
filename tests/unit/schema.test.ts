import { trackEventSchema } from "../../src/schema/eventSchema";

describe("trackEventSchema", () => {
  it("should pass with valid data", () => {
    const validData = {
      eventName: "click",
      url: "http://example.com",
      userId: "user123",
      metadata: { key: "value" },
    };
    const result = trackEventSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it("should pass with minimal valid data", () => {
    const minimalData = {
      eventName: "page_view",
      url: "http://example.com/home",
    };
    const result = trackEventSchema.safeParse(minimalData);
    expect(result.success).toBe(true);
  });

  it("should fail if eventName is missing", () => {
    const invalidData = {
      url: "http://example.com",
    };
    const result = trackEventSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.eventName).toContain("Event name is required");
    }
  });

  it("should fail if eventName is empty", () => {
    const invalidData = {
      eventName: "",
      url: "http://example.com",
    };
    const result = trackEventSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should fail if url is missing", () => {
    const invalidData = {
      eventName: "click",
    };
    const result = trackEventSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should strip extra fields", () => {
    const dataWithExtras = {
      eventName: "click",
      url: "http://example.com",
      extra: "should be gone",
    };
    const result = trackEventSchema.safeParse(dataWithExtras);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("extra");
    }
  });
});
