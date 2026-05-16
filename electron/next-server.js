const { createServer } = require("node:http");
const next = require("next");

const port = Number(process.env.PORT || 3000);
const hostname = "127.0.0.1";
const app = next({
  dev: false,
  dir: process.cwd(),
  hostname,
  port,
});

const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((request, response) => {
    handle(request, response);
  }).listen(port, hostname, () => {
    console.log(`Next.js ready on http://${hostname}:${port}`);
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
