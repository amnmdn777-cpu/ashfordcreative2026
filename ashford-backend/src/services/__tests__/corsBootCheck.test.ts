import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import http from "node:http";
import express from "express";
import cors from "cors";

/**
 * Locks down `runCorsBootCheck` — the boot-time CORS self-preflight that
 * runs on every production deploy. The whole point of this check is to
 * fail (process.exit 1) on a misconfigured allow-list so Replit's
 * startup health probe rolls the deploy back. Regressing it would
 * silently break the post-deploy CORS gate, so two paths are
 * exercised:
 *   - happy path: every expected origin is in the allow-list and is
 *     echoed back by the cors middleware → returns without calling
 *     process.exit.
 *   - mismatch path: an expected origin is NOT in the allow-list →
 *     process.exit is called with code 1.
 *
 * The test boots a real `express() + cors()` app with the same
 * middleware shape `app.ts` uses in production, so the assertions
 * exercise the actual cors lib behavior, not a hand-rolled fake.
 */

// Stub the logger so vitest output stays clean. Routing logger output
// to console would be fine too; we only care about the exit code.
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

type EnvShape = {
  allowedOrigins: string[] | null;
  expectedFrontendOrigins: string[] | null;
};

// `isProd` is exported as a const from lib/env, so we mock the whole
// module and let each test drive the values it needs. The boot check
// reads `env.allowedOrigins` and `env.expectedFrontendOrigins` and uses
// `isProd` only to decide whether the empty-allowedOrigins branch is
// fatal — every test below sets isProd=true since that's the only
// production-relevant code path.
const envState: { current: EnvShape } = {
  current: { allowedOrigins: null, expectedFrontendOrigins: null },
};
vi.mock("../../lib/env", () => ({
  get env() {
    return envState.current;
  },
  isProd: true,
}));

// Import AFTER vi.mock so the boot check sees the mocked modules.
const { runCorsBootCheck } = await import("../corsBootCheck");

const startServer = async (
  allowedOrigins: string[],
): Promise<{ server: http.Server; close: () => Promise<void> }> => {
  const app = express();
  // Mirror the production CORS wiring (see app.ts).
  app.use(
    cors({
      credentials: true,
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS: origin not allowed (${origin})`));
      },
    }),
  );
  app.get("/api/healthz", (_req, res) => res.status(200).json({ ok: true }));
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return {
    server,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
};

describe("runCorsBootCheck", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let closeServer: (() => Promise<void>) | null = null;

  beforeEach(() => {
    // Throw instead of actually exiting so each test can observe the
    // call without killing the vitest worker. The boot check treats
    // any throw out of `fail()` the same as an exit — control never
    // returns to it.
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error(`__test_exit__ ${code ?? 0}`);
      }) as never);
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    if (closeServer) {
      await closeServer();
      closeServer = null;
    }
  });

  it("returns without exiting when every expected origin is in the allow-list and echoed back with credentials", async () => {
    const origins = [
      "https://a.example.com",
      "https://b.example.com",
    ];
    const { server, close } = await startServer(origins);
    closeServer = close;
    envState.current = {
      allowedOrigins: origins,
      expectedFrontendOrigins: origins,
    };

    await expect(runCorsBootCheck(server)).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("exits 1 when an EXPECTED origin is NOT in the ALLOWED allow-list (set-comparison failure path — never even hits the network)", async () => {
    const allowed = ["https://a.example.com"];
    const expected = ["https://a.example.com", "https://typo.example.com"];
    const { server, close } = await startServer(allowed);
    closeServer = close;
    envState.current = {
      allowedOrigins: allowed,
      expectedFrontendOrigins: expected,
    };

    await expect(runCorsBootCheck(server)).rejects.toThrow(
      /__test_exit__ 1/,
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when the cors middleware fails to echo Access-Control-Allow-Origin for an expected origin (header-mismatch path)", async () => {
    // env says everything is fine (set comparison would pass), but the
    // running server's cors middleware doesn't actually know about
    // `https://b.example.com` — simulating a divergence between the
    // env var and the deployed code path that would otherwise look
    // healthy from the env alone.
    const expected = ["https://a.example.com", "https://b.example.com"];
    const { server, close } = await startServer(["https://a.example.com"]);
    closeServer = close;
    envState.current = {
      allowedOrigins: expected,
      expectedFrontendOrigins: expected,
    };

    await expect(runCorsBootCheck(server)).rejects.toThrow(
      /__test_exit__ 1/,
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
