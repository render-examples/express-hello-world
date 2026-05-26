const assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");

const app = require("./app");

let server;
let baseUrl;

function request(path) {
  return fetch(`${baseUrl}${path}`);
}

describe("Express app", () => {
  before(async () => {
    server = app.listen(0);

    await new Promise((resolve) => {
      server.once("listening", resolve);
    });

    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it("returns the home page", async () => {
    const response = await request("/");
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    assert.match(body, /Hello from 23521574/);
  });

  it("returns 404 for unknown routes", async () => {
    const response = await request("/not-found");

    assert.equal(response.status, 404);
  });
});
