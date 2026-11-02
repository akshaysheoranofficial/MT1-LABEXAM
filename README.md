# MT1-LABEXAM

Shopping cart APIs implemented with Node.js's built-in HTTP module and Express. The servers use in-memory arrays, so data resets when a server restarts.

## Setup and run

Requires Node.js 18 or later.

```bash
npm install
npm run start:http
npm run start:express
npm test
```

Run each server in a separate terminal. The built-in HTTP server uses port 3000; Express uses port 4000.
`npm test` runs isolated API smoke tests on temporary ports and does not interrupt servers already running on the default ports.

## Built-in HTTP server

- `GET /` - HTML welcome page
- `GET /cart` - cart contents
- `GET /about` - application information
- `GET /home` - `public/index.html`
- `POST /add-to-cart` - add a product (`id`, `productName`, `price`, `quantity`)

## Express API

- `GET /cart` - list products with calculated `totalPrice`
- `GET /cart/:id` - retrieve a product
- `POST /cart` or `POST /cart/:id` - add a product
- `PUT /cart` or `PUT /cart/:id` - update a product
- `DELETE /cart` or `DELETE /cart/:id` - remove a product

Send and receive JSON. The Express sample cart includes three products on startup.

## Screenshots

The `screenshots/` folder contains evidence of both server startup, the HTTP home page, the GitHub commit history, and Express API requests:

- `http-server-running.jpg` and `express-server-running.jpg` - server startup messages
- `http-home-page.jpg` - static home page served by the HTTP server
- `github-commit-history.jpg` - repository commit history
- `api-get-cart.jpg`, `api-post-cart.jpg`, `api-put-cart.jpg`, and `api-delete-cart.jpg` - Express CRUD requests and responses
