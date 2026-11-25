# E-Gift Shopping API

FastAPI service behind the E-Gift Shopping storefront. It handles authentication, the product catalog, cart, wishlist, addresses, orders, hamper requests, search suggestions, event tracking, recommendations and the admin API. Data is stored in SQLite through SQLAlchemy.

The legacy Flask app in the repository root (`app.py`) still exists. The storefront calls it for a few older product and cart endpoints (port 5000).

## Requirements

- Python 3.11 or newer

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS / Linux
pip install -r requirements.txt
cp .env.example .env            # Windows: copy .env.example .env
```

Edit `.env` and set `ECHOMART_JWT_SECRET` to a random string of at least 32 characters. The API refuses to start without it.

## Configuration

Settings are read from `backend/.env` or the environment. All variables use the `ECHOMART_` prefix. Defaults are in [app/config/settings.py](app/config/settings.py).

| Variable | Default | Purpose |
| --- | --- | --- |
| `ECHOMART_JWT_SECRET` | none (required) | Signing key for tokens, at least 32 characters |
| `ECHOMART_DATABASE_URL` | `sqlite:///data/echomart.db` | Database connection |
| `ECHOMART_ACCESS_TOKEN_MINUTES` | `15` | Access token lifetime |
| `ECHOMART_REFRESH_TOKEN_DAYS` | `7` | Refresh cookie lifetime |
| `ECHOMART_COOKIE_SECURE` | `false` | Set `true` when served over HTTPS |
| `ECHOMART_CORS_ORIGINS` | `localhost:4300`, `localhost:4200` | Allowed browser origins |
| `ECHOMART_CORS_ORIGIN_REGEX` | any localhost port | Development convenience. Set empty in production |
| `ECHOMART_ADMIN_EMAILS` | empty | Emails that receive the ADMIN role at sign-up |
| `ECHOMART_USD_TO_INR_RATE` | `83.0` | Rate used when importing USD-priced catalogs |
| `ECHOMART_REC_*` | see settings | Recommendation weights, minimum active users and cache time |

## Run

```bash
uvicorn app.main:create_app --factory --port 8000 --reload
```

Interactive API docs are served at `http://localhost:8000/docs`.

## Test

```bash
pytest
```

## Seed data and admin accounts

Run these from the `backend` folder.

```bash
python -m scripts.import_products                            # seed the catalog from a CSV (--csv, --limit, --seed, --currency)
python -m scripts.generate_gift_catalog                      # generate a sample gift catalog CSV (--out, --seed, --images)
python -m scripts.import_archies ../models/archies_gifts_with_ch_2000.csv   # import Archies products from a Shopify export
python -m scripts.make_admin you@example.com                 # promote an existing account to admin
python -m scripts.set_admin_credentials you@example.com      # create or update an admin, prompts for the password
```

## Endpoints

All paths are under `/api`. Responses use `{ "success", "data", "message" }`. Errors use `{ "success": false, "message", "errors": [{ "field", "message" }] }`.

| Area | Paths |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me` |
| Catalog | `GET /products`, `/products/{id}`, `/categories`, `/brands` |
| Search | `GET /search/suggestions` |
| Cart | `GET /cart`; `POST /cart/items`, `/cart/merge`; `PATCH`, `DELETE /cart/items/{productId}` |
| Wishlist | `GET /wishlist`; `POST /wishlist/items`, `/wishlist/items/{productId}/move-to-cart`; `DELETE /wishlist/items/{productId}` |
| Addresses | `GET`, `POST /addresses`; `PUT`, `DELETE /addresses/{id}` |
| Orders | `GET`, `POST /orders`; `GET /orders/{id}`; `POST /orders/{id}/cancel` |
| Hampers | `POST`, `GET /hampers` |
| Events | `POST /events` |
| Recommendations | `GET /recommendations/home`, `/user`, `/product/{id}`, `/similar/{id}`, `/frequently-bought/{id}` |
| Admin (ADMIN role) | `GET /admin/dashboard`; products CRUD and `PATCH /admin/products/{id}/stock`; `GET /admin/orders`, `PATCH /admin/orders/{id}/status`, `/payment`; `GET /admin/users`, `PATCH /admin/users/{id}/active`; `/admin/hampers` |

## Recommendations

Scores combine content similarity, collaborative filtering, popularity and recency, weighted by the `ECHOMART_REC_*` settings. Collaborative filtering is used once there are enough active users (`ECHOMART_REC_MIN_ACTIVE_USERS`). Results are cached for `ECHOMART_REC_CACHE_SECONDS`.

## Project layout

```
app/
  main.py            Application factory and router registration
  config/            Settings and database setup
  auth/              Password hashing and token handling
  models/            SQLAlchemy models
  schemas/           Pydantic request and response schemas
  repositories/      Database access
  services/          Business logic
  routes/            HTTP routers
  recommendation/    Recommendation model
  utils/             Shared error types
scripts/             Seed and admin command-line tools
tests/               pytest suite
data/                SQLite database (created on first run)
```

## Security notes

- Passwords are hashed with Argon2id. Plaintext is never stored or logged.
- Login returns the same message for unknown emails and wrong passwords.
- Access tokens last 15 minutes by default. The refresh token is an httpOnly cookie scoped to `/api/auth`.

## Known limits

- Refresh tokens are stateless, so logout clears the cookie but cannot revoke a token that was already copied.
- No rate limiting yet. Add it before production.
- Tables are created on startup. Alembic migrations are not set up yet.
