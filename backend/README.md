# E-Gift Shopping API

FastAPI service for authentication. Product, cart and recommendation endpoints are still served by the legacy Flask app in the repository root.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env          # then set ECHOMART_JWT_SECRET
```

## Run

```bash
uvicorn app.main:create_app --factory --port 8000 --reload
```

## Test

```bash
pytest
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create an account (fullName, email, phone, password) |
| POST | `/api/auth/login` | Sign in. Returns an access token and sets the refresh cookie |
| POST | `/api/auth/refresh` | Issue a new access token from the refresh cookie |
| POST | `/api/auth/logout` | Clear the refresh cookie |
| GET | `/api/auth/me` | Current user (Bearer access token) |
| GET | `/api/health` | Health check |

Responses use `{ "success", "data", "message" }`. Errors use `{ "success": false, "message", "errors": [{ "field", "message" }] }`.

## Security notes

- Passwords are hashed with Argon2id. Plaintext is never stored or logged.
- Login returns the same message for unknown emails and wrong passwords.
- Access tokens last 15 minutes. The refresh token is an httpOnly cookie scoped to `/api/auth`.
- Emails in `ECHOMART_ADMIN_EMAILS` receive the ADMIN role at sign-up.

## Known limits

- Refresh tokens are stateless, so logout clears the cookie but cannot revoke a token that was already copied.
- No rate limiting yet. Add it before production.
- Tables are created on startup. Alembic migrations are not set up yet.
