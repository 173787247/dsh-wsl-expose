import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { format } from "../lib/expose.js";

describe("wsl_expose", () => {
  it("formats", () => {
    assert.match(format({ ok: true }), /ok/i);
  });
});
