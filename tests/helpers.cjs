const fs = require("node:fs");
const vm = require("node:vm");

function loadModuleExports(filePath, names) {
  let source = fs.readFileSync(filePath, "utf8");
  source = source.replace(/^import .*$/gm, "");
  source = source.replace(/export function /g, "function ");
  source = source.replace(/export const /g, "const ");
  source += `\nmodule.exports = { ${names.join(", ")} };\n`;

  const context = {
    module: { exports: {} },
    exports: {},
    console,
    Date,
    Math,
    Number,
    String,
    RegExp,
    Array,
    Object,
    Set,
    Map,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: filePath });
  return context.module.exports;
}

module.exports = { loadModuleExports };
