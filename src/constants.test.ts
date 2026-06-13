import { describe, it, expect } from "vitest"
import {
  ANTIGRAVITY_CLI_HEADERS,
  getRandomizedHeaders,
  type HeaderSet,
} from "./constants.ts"

describe("ANTIGRAVITY_CLI_HEADERS", () => {
  it("matches Go-based antigravity-cli headers", () => {
    const os = process.platform === "win32" ? "windows" : process.platform;
    const arch = process.arch === "x64" ? "amd64" : process.arch;
    const metadataPlatform = os === "windows" ? "WINDOWS" : "MACOS";

    expect(ANTIGRAVITY_CLI_HEADERS["User-Agent"]).toBe(`antigravity/cli/1.0.1 ${os}/${arch}`)
    expect(ANTIGRAVITY_CLI_HEADERS["X-Goog-Api-Client"]).toBeUndefined()
    expect(JSON.parse(ANTIGRAVITY_CLI_HEADERS["Client-Metadata"]!)).toEqual({
      ideType: "ANTIGRAVITY_CLI",
      platform: metadataPlatform,
      pluginType: "NONE",
    })
  })
})

describe("getRandomizedHeaders", () => {
  describe("antigravity-cli style", () => {
    it("returns static antigravity-cli headers", () => {
      const headers = getRandomizedHeaders("antigravity-cli", "gemini-2.5-pro")
      const os = process.platform === "win32" ? "windows" : process.platform;
      const arch = process.arch === "x64" ? "amd64" : process.arch;
      const metadataPlatform = os === "windows" ? "WINDOWS" : "MACOS";

      expect(headers["User-Agent"]).toBe(`antigravity/cli/1.0.1 ${os}/${arch}`)
      expect(headers["X-Goog-Api-Client"]).toBeUndefined()
      expect(JSON.parse(headers["Client-Metadata"]!)).toEqual({
        ideType: "ANTIGRAVITY_CLI",
        platform: metadataPlatform,
        pluginType: "NONE",
      })
    })

    it("ignores requested model and keeps static User-Agent", () => {
      const headers = getRandomizedHeaders("antigravity-cli", "gemini-3-pro-preview")
      const os = process.platform === "win32" ? "windows" : process.platform;
      const arch = process.arch === "x64" ? "amd64" : process.arch;
      expect(headers["User-Agent"]).toBe(`antigravity/cli/1.0.1 ${os}/${arch}`)
    })
  })

  describe("antigravity style", () => {
    it("returns all three headers", () => {
      const headers = getRandomizedHeaders("antigravity")
      expect(headers["User-Agent"]).toBeDefined()
      expect(headers["X-Goog-Api-Client"]).toBeDefined()
      expect(headers["Client-Metadata"]).toBeDefined()
    })

    it("returns User-Agent in antigravity format", () => {
      const headers = getRandomizedHeaders("antigravity")
      expect(headers["User-Agent"]).toMatch(/^antigravity\//)
    })

    it("aligns Client-Metadata platform with User-Agent platform", () => {
      for (let i = 0; i < 50; i++) {
        const headers = getRandomizedHeaders("antigravity")
        const ua = headers["User-Agent"]!
        const metadata = JSON.parse(headers["Client-Metadata"]!)
        if (ua.includes("windows/")) {
          expect(metadata.platform).toBe("WINDOWS")
        } else {
          expect(metadata.platform).toBe("MACOS")
        }
      }
    })

    it("never produces a linux User-Agent", () => {
      for (let i = 0; i < 50; i++) {
        const headers = getRandomizedHeaders("antigravity")
        expect(headers["User-Agent"]).not.toMatch(/linux\//)
      }
    })
  })
})

describe("HeaderSet type", () => {
  it("allows omitting X-Goog-Api-Client and Client-Metadata", () => {
    const headers: HeaderSet = {
      "User-Agent": "test",
    }
    expect(headers["User-Agent"]).toBe("test")
    expect(headers["X-Goog-Api-Client"]).toBeUndefined()
    expect(headers["Client-Metadata"]).toBeUndefined()
  })

  it("allows including all three headers", () => {
    const headers: HeaderSet = {
      "User-Agent": "test",
      "X-Goog-Api-Client": "test-client",
      "Client-Metadata": "test-metadata",
    }
    expect(headers["User-Agent"]).toBe("test")
    expect(headers["X-Goog-Api-Client"]).toBe("test-client")
    expect(headers["Client-Metadata"]).toBe("test-metadata")
  })
})
