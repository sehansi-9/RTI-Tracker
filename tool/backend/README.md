# Backend Setup Guide

This guide provides the necessary steps to set up the local development environment, seed the database, and authenticate with the Asgardeo identity provider.

## 1. Database Seeding
Before running the application, you must initialize the database schema and populate it with initial data.

* **Instruction File:** Refer to `sql/README.md` for specific SQL scripts and database configuration details.

## 2. Environment Setup
We use `uv` for Python package management. Follow these steps to prepare your environment:

```bash
# Navigate to the backend directory
cd tool/backend

# Create a virtual environment
python -m venv .venv

# Activate the virtual environment
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
# .venv\Scripts\activate

# Install required packages
uv sync
```

## 3. Running the application
Once the dependencies are installed and the virtual environment is active, start the FastAPI server:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Local URL: http://localhost:8000

API Documentation: http://localhost:8000/docs (Swagger UI)

## 4. Authentication & Authorization
The API uses Asgardeo for OAuth2 authentication.

#### A. Generate Client Credentials
To generate the Base64 encoded string for your Authorization: Basic header, use the following command:

```bash
echo -n "client_ID:client_secret" | base64
```

#### B. Fetch Access Token
Use the following curl request to obtain an OpenID Connect (OIDC) token. This token is required to access protected endpoints.

```bash
curl --location 'https://api.asgardeo.io/t/{org}/oauth2/token' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--header 'Authorization: Basic {base64<client_id:client_secret>}' \
--data-urlencode 'grant_type=password' \
--data-urlencode 'username={username}' \
--data-urlencode 'password={password}' \
--data-urlencode 'scope=openid email groups'
```

