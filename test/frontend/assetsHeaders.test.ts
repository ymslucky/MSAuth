import { describe, expect, it } from "vitest";
import headers from "../../frontend/public/_headers?raw";

// Static SPA pages are served by Workers Assets without passing through the
// worker's secureHeaders middleware — the _headers file is the only place the
// HTML responses get their CSP and anti-framing defenses. It must mirror
// src/platform.ts.
describe("Static asset security headers", () => {
  const cspLine = headers.split("\n").find(line => line.trim().startsWith("Content-Security-Policy:")) ?? "";

  it("applies to every static route", () => {
    // comment lines precede the rule — match the rule itself, not the first line
    const rule = headers.split("\n").map(line => line.trim()).find(line => line.startsWith("/*"));
    expect(rule).toBe("/*");
  });

  it("mirrors the worker CSP for HTML responses", () => {
    expect(cspLine).toContain("default-src 'self'");
    expect(cspLine).toContain("script-src 'self'");
    expect(cspLine).toContain("style-src 'self' 'unsafe-inline'");
    expect(cspLine).toContain("img-src 'self' data:");
    expect(cspLine).toContain("connect-src 'self'");
    expect(cspLine).toContain("frame-ancestors 'none'");
    expect(cspLine).toContain("object-src 'none'");
    expect(cspLine).toContain("base-uri 'self'");
    expect(cspLine).toContain("form-action 'self'");
  });

  it("hardens against framing, sniffing and referrer leaks", () => {
    expect(headers).toContain("X-Frame-Options: DENY");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("Referrer-Policy: no-referrer");
  });
});
