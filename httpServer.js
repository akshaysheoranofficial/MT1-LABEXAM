import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PORT = 3000;
const publicDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const cart = [];

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function validProduct(product) {
  return product
    && Number.isInteger(Number(product.id))
    && String(product.productName ?? "").trim().length > 0
    && Number.isFinite(Number(product.price))
    && Number(product.price) >= 0
    && Number.isInteger(Number(product.quantity))
    && Number(product.quantity) > 0;
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  const route = `${request.method} ${url.pathname}`;

  try {
    if (route === "GET /") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<!doctype html><html><head><title>Shopping Cart</title></head><body><h1>Welcome to the Shopping Cart API</h1></body></html>");
    } else if (route === "GET /cart") {
      sendJson(response, 200, cart);
    } else if (route === "GET /about") {
      sendJson(response, 200, {
        application: "Shopping Cart API",
        description: "A simple Node.js HTTP server for managing cart products",
        port: PORT
      });
    } else if (route === "GET /home") {
      const html = await readFile(path.join(publicDirectory, "index.html"));
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
    } else if (route === "POST /add-to-cart") {
      const product = await readJsonBody(request);
      if (!validProduct(product)) {
        sendJson(response, 400, { error: "Provide id (integer), productName (non-empty), price (non-negative number), and quantity (positive integer)" });
      } else if (cart.some((item) => item.id === Number(product.id))) {
        sendJson(response, 409, { error: "A product with this id already exists" });
      } else {
        const newProduct = {
          id: Number(product.id),
          productName: String(product.productName).trim(),
          price: Number(product.price),
          quantity: Number(product.quantity)
        };
        cart.push(newProduct);
        sendJson(response, 201, { message: "Product added to cart", product: newProduct });
      }
    } else {
      sendJson(response, 404, { error: "Route not found" });
    }
  } catch (error) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message });
    } else {
      console.error("Request failed:", error);
      sendJson(response, 500, { error: "Unable to complete the request" });
    }
  }
});

server.listen(PORT, () => {
  console.log(`HTTP Server running at http://localhost:${PORT}`);
});
