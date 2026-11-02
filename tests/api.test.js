import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function unusedPort() {
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function withServer(script, callback) {
  const port = await unusedPort();
  const server = spawn(process.execPath, [path.join(projectRoot, script)], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  let errors = "";
  server.stdout.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
  server.stderr.setEncoding("utf8").on("data", (chunk) => { errors += chunk; });
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (server.exitCode !== null) break;
      try {
        const response = await fetch(`${baseUrl}/`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    assert.ok(ready, `Server failed to start.\n${output}\n${errors}`);
    await callback(baseUrl);
  } finally {
    if (server.exitCode === null) {
      const exited = once(server, "exit");
      server.kill();
      await exited;
    }
  }
}

async function request(baseUrl, method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  return { status: response.status, data };
}

test("built-in HTTP server routes, static file, and product validation", async () => {
  await withServer("httpServer.js", async (baseUrl) => {
    assert.equal((await request(baseUrl, "GET", "/")).status, 200);
    assert.deepEqual((await request(baseUrl, "GET", "/cart")).data, []);
    assert.equal((await request(baseUrl, "GET", "/about")).status, 200);
    const home = await request(baseUrl, "GET", "/home");
    assert.equal(home.status, 200);
    assert.match(home.data, /<h1>Shopping Cart<\/h1>/);
    assert.equal((await request(baseUrl, "GET", "/not-a-route")).status, 404);
    const added = await request(baseUrl, "POST", "/add-to-cart", {
      id: 11,
      productName: "Test item",
      price: 2,
      quantity: 3
    });
    assert.equal(added.status, 201);
    assert.equal(added.data.product.id, 11);
    assert.equal((await request(baseUrl, "POST", "/add-to-cart", { id: 12 })).status, 400);
  });
});

test("Express cart CRUD, totals, alternate URL forms, and errors", async () => {
  await withServer("expressApp.js", async (baseUrl) => {
    const initial = await request(baseUrl, "GET", "/cart");
    assert.equal(initial.status, 200);
    assert.equal(initial.data.length, 3);
    assert.equal(initial.data[0].totalPrice, initial.data[0].price * initial.data[0].quantity);

    const created = await request(baseUrl, "POST", "/cart/1", {
      id: 4,
      productName: "Bluetooth Headphones",
      price: 1499,
      quantity: 1,
      category: "Electronics"
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.product.totalPrice, 1499);
    assert.equal((await request(baseUrl, "POST", "/cart", created.data.product)).status, 409);

    const updated = await request(baseUrl, "PUT", "/cart/4", {
      productName: "Wireless Mouse",
      price: 899,
      quantity: 3,
      category: "Electronics"
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.product.totalPrice, 2697);
    assert.equal((await request(baseUrl, "PUT", "/cart", { id: 4, quantity: 2 })).status, 200);

    assert.equal((await request(baseUrl, "GET", "/cart/4")).data.quantity, 2);
    assert.equal((await request(baseUrl, "GET", "/cart/404")).status, 404);
    assert.equal((await request(baseUrl, "POST", "/cart", { id: 5 })).status, 400);
    assert.equal((await request(baseUrl, "DELETE", "/cart/4")).status, 200);
    assert.equal((await request(baseUrl, "DELETE", "/cart/4")).status, 404);
  });
});
