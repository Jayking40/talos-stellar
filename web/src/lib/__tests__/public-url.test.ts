import { getPublicBaseUrl } from "../public-url";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("getPublicBaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return localhost in development if no headers provided", () => {
    process.env.NODE_ENV = "development";
    const headers = new Headers();
    expect(getPublicBaseUrl(headers)).toBe("http://localhost:3000");
  });

  it("should return configured APP_URL if no headers provided in production", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "https://talos.example.com";
    const headers = new Headers();
    expect(getPublicBaseUrl(headers)).toBe("https://talos.example.com");
  });

  it("should accept explicit trusted host", () => {
    process.env.NODE_ENV = "production";
    process.env.TRUSTED_HOSTS = "trusted.example.com,also-trusted.com";
    const headers = new Headers({
      host: "trusted.example.com"
    });
    expect(getPublicBaseUrl(headers)).toBe("https://trusted.example.com"); // defaults to https
  });

  it("should prioritize x-forwarded-host and x-forwarded-proto", () => {
    process.env.NODE_ENV = "production";
    process.env.TRUSTED_HOSTS = "proxy.example.com";
    const headers = new Headers({
      host: "internal.local",
      "x-forwarded-host": "proxy.example.com",
      "x-forwarded-proto": "http"
    });
    expect(getPublicBaseUrl(headers)).toBe("http://proxy.example.com");
  });

  it("should fallback to APP_URL if host is untrusted", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "https://safe.example.com";
    const headers = new Headers({
      host: "evil.com"
    });
    expect(getPublicBaseUrl(headers)).toBe("https://safe.example.com");
  });

  it("should throw if host is untrusted and no APP_URL is configured", () => {
    process.env.NODE_ENV = "production";
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.TRUSTED_HOSTS = "good.com";
    
    const headers = new Headers({
      host: "evil.com"
    });
    expect(() => getPublicBaseUrl(headers)).toThrow("Untrusted host header");
  });

  it("should accept localhost in development automatically", () => {
    process.env.NODE_ENV = "development";
    const headers = new Headers({
      host: "localhost:3000"
    });
    expect(getPublicBaseUrl(headers)).toBe("http://localhost:3000");
  });

  it("should accept localhost in test automatically", () => {
    process.env.NODE_ENV = "test";
    const headers = new Headers({
      host: "127.0.0.1:8080"
    });
    expect(getPublicBaseUrl(headers)).toBe("http://127.0.0.1:8080");
  });

  it("should reject ambiguous x-forwarded-host", () => {
    process.env.NODE_ENV = "production";
    const headers = new Headers({
      "x-forwarded-host": "good.com, evil.com"
    });
    expect(() => getPublicBaseUrl(headers)).toThrow("Ambiguous X-Forwarded-Host");
  });

  it("should reject ambiguous host", () => {
    process.env.NODE_ENV = "production";
    const headers = new Headers({
      "host": "good.com, evil.com"
    });
    expect(() => getPublicBaseUrl(headers)).toThrow("Ambiguous Host");
  });

  it("should reject malformed host with path injection", () => {
    process.env.NODE_ENV = "production";
    const headers = new Headers({
      "host": "good.com/evil"
    });
    expect(() => getPublicBaseUrl(headers)).toThrow("Malformed host header");
  });
});
