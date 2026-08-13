import { describe, expect, it } from "vitest";
import {
  functionErrorMessage,
  SESSION_EXPIRED_MESSAGE,
} from "./functionErrors";

describe("functionErrorMessage", () => {
  it("translates a function 401 into sign-in guidance", async () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    });

    await expect(functionErrorMessage(error)).resolves.toBe(SESSION_EXPIRED_MESSAGE);
  });

  it("uses only the safe server error field for non-auth failures", async () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify({
        error: "Template not found",
        details: { secret: "must not be shown" },
      }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    });

    await expect(functionErrorMessage(error)).resolves.toBe("Template not found");
  });

  it("falls back to the original error message for a non-JSON response", async () => {
    const error = Object.assign(new Error("Email service is unavailable"), {
      context: new Response("gateway failure", {
        status: 502,
        headers: { "content-type": "text/plain" },
      }),
    });

    await expect(functionErrorMessage(error)).resolves.toBe("Email service is unavailable");
  });

  it("uses the supplied fallback for malformed error values", async () => {
    await expect(functionErrorMessage({ unexpected: true }, "Could not send email")).resolves.toBe("Could not send email");
  });
});
