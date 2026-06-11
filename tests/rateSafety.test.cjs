const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { loadModuleExports } = require("./helpers.cjs");

const rateSafety = loadModuleExports(path.join(__dirname, "..", "lib", "rateSafety.js"), [
  "applyAdaptiveDelay",
  "classifyFailure",
  "nextAllowedSendTime",
  "parseVariants",
  "pickVariant",
  "sanitizeRateLimits",
  "withinQuietHours",
]);

test("quiet hours support overnight windows", () => {
  const settings = { quietHoursEnabled: true, quietHoursStart: "21:00", quietHoursEnd: "09:00" };
  assert.equal(rateSafety.withinQuietHours(new Date("2026-06-07T23:30:00"), settings), true);
  assert.equal(rateSafety.withinQuietHours(new Date("2026-06-07T12:00:00"), settings), false);
});

test("adaptive delay increases when issue rate is high", () => {
  const delay = rateSafety.applyAdaptiveDelay(1000, 2000, { sent: 1, failed: 1, skipped: 0 }, {});
  assert.ok(delay.minDelayMs > 1000);
  assert.ok(delay.maxDelayMs > 2000);
});

test("variant parser and picker expose A/B message variants", () => {
  const variants = rateSafety.parseVariants("A text\n--- variant ---\nB text");
  assert.equal(JSON.stringify(variants), JSON.stringify(["A text", "B text"]));
  const picked = rateSafety.pickVariant("A text\n--- variant ---\nB text", { number: "923001234567" }, 0);
  assert.match(picked.key, /^[AB]$/);
  assert.ok(variants.includes(picked.message));
});

test("failure classifier groups common send problems", () => {
  assert.equal(rateSafety.classifyFailure("Number not on WhatsApp"), "not_on_whatsapp");
  assert.equal(rateSafety.classifyFailure("socket closed"), "connection");
});
