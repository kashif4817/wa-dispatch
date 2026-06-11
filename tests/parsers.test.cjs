const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { loadModuleExports } = require("./helpers.cjs");

const parsers = loadModuleExports(path.join(__dirname, "..", "lib", "parsers.js"), [
  "normalizeNumber",
  "parseCsvText",
  "parseJsonText",
  "personalizeMessage",
  "validateRecipients",
]);

test("parseCsvText keeps custom fields for template variables", () => {
  const rows = parsers.parseCsvText("name,number,company\nAli,03001234567,Acme");
  assert.equal(rows[0].name, "Ali");
  assert.equal(rows[0].company, "Acme");
});

test("personalizeMessage fills name, custom fields, variants, and date", () => {
  const message = "Hi {name} from {company}. {Hello|Salaam}. {date}";
  const output = parsers.personalizeMessage(message, { name: "Ali", company: "Acme" });
  assert.match(output, /^Hi Ali from Acme\. (Hello|Salaam)\. \d/);
});

test("validateRecipients normalizes local numbers with default country code", () => {
  const { valid, invalid } = parsers.validateRecipients([{ number: "03001234567" }], "92");
  assert.equal(invalid.length, 0);
  assert.equal(valid[0].number, "923001234567");
});
