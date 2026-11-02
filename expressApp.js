import express from "express";

const PORT = 4000;
const app = express();
app.use(express.json({ limit: "1mb" }));

let cart = [
  { id: 1, productName: "Notebook", price: 3.5, quantity: 2, category: "Stationery" },
  { id: 2, productName: "Pen", price: 1.25, quantity: 4, category: "Stationery" },
  { id: 3, productName: "Water Bottle", price: 12, quantity: 1, category: "Accessories" }
];

function withTotal(product) {
  return { ...product, totalPrice: Number((product.price * product.quantity).toFixed(2)) };
}

function validateProduct(body, { requireCategory = true } = {}) {
  const errors = [];
  if (!Number.isInteger(Number(body?.id))) errors.push("id must be an integer");
  if (typeof body?.productName !== "string" || !body.productName.trim()) errors.push("productName must be a non-empty string");
  if (!Number.isFinite(Number(body?.price)) || Number(body.price) < 0) errors.push("price must be a non-negative number");
  if (!Number.isInteger(Number(body?.quantity)) || Number(body.quantity) < 1) errors.push("quantity must be a positive integer");
  if (requireCategory && (typeof body?.category !== "string" || !body.category.trim())) errors.push("category must be a non-empty string");
  return errors;
}

function normalizeProduct(body) {
  return {
    id: Number(body.id),
    productName: body.productName.trim(),
    price: Number(body.price),
    quantity: Number(body.quantity),
    category: typeof body.category === "string" ? body.category.trim() : "Uncategorized"
  };
}

function findProduct(id) {
  return cart.find((product) => product.id === Number(id));
}

app.get("/", (_request, response) => {
  response.json({ message: "Welcome to the Shopping Cart API" });
});

app.get("/cart", (_request, response) => {
  response.json(cart.map(withTotal));
});

app.get("/cart/:id", (request, response) => {
  const product = findProduct(request.params.id);
  if (!product) return response.status(404).json({ error: "Product not found" });
  return response.json(withTotal(product));
});

function addProduct(request, response) {
  const errors = validateProduct(request.body);
  if (errors.length) return response.status(400).json({ error: "Invalid product", details: errors });
  const product = normalizeProduct(request.body);
  if (cart.some((item) => item.id === product.id)) {
    return response.status(409).json({ error: "A product with this id already exists" });
  }
  cart.push(product);
  return response.status(201).json({ message: "Product added to cart", product: withTotal(product) });
}

app.post("/cart", addProduct);
app.post("/cart/:id", (request, response) => {
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
    return response.status(400).json({ error: "Request body must be a JSON object" });
  }
  if (request.body.id === undefined) request.body.id = request.params.id;
  else if (Number(request.body.id) !== Number(request.params.id)) {
    return response.status(400).json({ error: "Path id must match body id" });
  }
  return addProduct(request, response);
});

function updateProduct(request, response) {
  const id = Number(request.params.id ?? request.body?.id);
  if (!Number.isInteger(id)) return response.status(400).json({ error: "A valid product id is required" });
  const index = cart.findIndex((product) => product.id === id);
  if (index === -1) return response.status(404).json({ error: "Product not found" });
  const errors = validateProduct({ ...cart[index], ...request.body, id });
  if (errors.length) return response.status(400).json({ error: "Invalid product", details: errors });

  const updated = normalizeProduct({ ...cart[index], ...request.body, id });
  cart[index] = updated;
  return response.json({ message: "Product updated", product: withTotal(updated) });
}

app.put("/cart", updateProduct);
app.put("/cart/:id", updateProduct);

function deleteProduct(request, response) {
  const id = Number(request.params.id ?? request.body?.id);
  if (!Number.isInteger(id)) return response.status(400).json({ error: "A valid product id is required" });
  const index = cart.findIndex((product) => product.id === id);
  if (index === -1) return response.status(404).json({ error: "Product not found" });
  const [removed] = cart.splice(index, 1);
  return response.json({ message: "Product removed", product: withTotal(removed) });
}

app.delete("/cart/:id", deleteProduct);
app.delete("/cart", deleteProduct);

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return response.status(400).json({ error: "Request body must be valid JSON" });
  }
  if (error.type === "entity.too.large") {
    return response.status(413).json({ error: "Request body is too large" });
  }
  console.error("Request failed:", error);
  return response.status(500).json({ error: "Unable to complete the request" });
});

app.use((_request, response) => {
  response.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Express Server running at http://localhost:${PORT}`);
});
