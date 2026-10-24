<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1-p94-sX-38X0oAcnSg-aKAm-vIrLT2fY

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `VITE_API_URL` in [.env.local](.env.local) to the FastAPI service URL. Gemini keys are server-side only and are not bundled into the browser.
3. Run the app:
   `npm run dev`

## Client and Analyst Accounts

Email and password are the primary sign-in method. Public registration creates client accounts. Analyst registration requires both `ANALYST_REGISTRATION_CODE` and a semicolon-separated `ANALYST_REGISTRATION_EMAILS` allowlist on the backend. The initial allowlist is `ramsey@mandlakazi.co.za;ramseyntombela@gmail.com`; issue the invitation code only to these trusted staff. Existing analyst/admin accounts can sign in without registering. Google sign-in in Analyst mode also requires an existing analyst/admin account. Clients submit exploration requests and track their status. Analysts review requests, start processing, and release completed reports from the client request queue.

Google sign-in is optional. Create a Google OAuth client ID for a web application and add each local frontend origin (for example, `http://localhost:5173` and `http://localhost:5174`) to its authorized JavaScript origins. Set the same client ID as `VITE_GOOGLE_CLIENT_ID` in the frontend environment and `GOOGLE_CLIENT_ID` in the backend environment. The ID token is verified by the backend; no Google client secret is placed in the frontend.
