# Venturelyx Auth Testing Playbook

Unified auth: both email/password (JWT) and Emergent Google login issue the SAME httpOnly `access_token` JWT cookie. `get_current_user` validates the JWT from cookie (or Authorization: Bearer).

## Accounts
- Owner: usasaranga@gmail.com / Venturelyx2026! (seeded on startup)

## API test (email/password)
```
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"usasaranga@gmail.com","password":"Venturelyx2026!"}'
curl -b cookies.txt http://localhost:8001/api/auth/me
```
Login returns the user object and sets `access_token` cookie. `/me` returns the same user.

## Register
```
curl -c c.txt -X POST http://localhost:8001/api/auth/register -H "Content-Type: application/json" -d '{"email":"new@test.com","password":"pass1234","name":"New"}'
```

## Protected endpoints (need cookie)
- POST /api/business (onboarding; auto-seeds demo data)
- GET /api/dashboard, /api/leads, /api/jobs, /api/invoices, /api/reviews
- POST /api/seo/scan {"url":"example.com"}
- POST /api/ai/generate {"feature":"review_response","context":{...}}

## Google login (browser)
Frontend "Continue with Google" -> redirect to https://auth.emergentagent.com/?redirect=<origin>/dashboard
Returns to /dashboard#session_id=... -> frontend POSTs {session_id} to /api/auth/google/session -> backend exchanges, upserts user, sets JWT cookie.
Callback detection uses useLocation().hash.
