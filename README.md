# PaisaBachao

**Your Money. Your Control. Your Savings.**

A personal and shared finance app that works in the browser and installs on phones. It combines a cash book with the tools other apps charge for, and every feature is free.

## Run it on your computer

You need Node.js 20 or newer.

1. Install the packages:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in at least `MONGODB_URI` and `AUTH_SECRET`. See [Accounts to set up](#accounts-to-set-up).

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 and create an account.

Use `npm run build` and then `npm start` to run the production version.

## Accounts to set up

Only MongoDB is required. Each of the others switches on when you add its keys to `.env.local`.

| Service | What it adds | Without it |
| --- | --- | --- |
| **MongoDB Atlas** (required) | The database. Free tier is fine. | The app will not start. |
| **Google Cloud OAuth client** | The Continue with Google button | Email and password sign-in only |
| **SMTP email** (for example Brevo or Gmail) | Verification, password reset and invite emails | Links are printed in the server log. Invite links can still be copied and shared by hand. |
| **Cloudinary** | Durable storage for receipts and pictures | Files are saved in `.uploads` on the server, which Render erases on each deploy |
| **Gemini API key** (optional) | More accurate scans, handwriting, and free-form assistant questions | Free OCR scanning and built-in assistant answers |

For Google sign-in, add `<APP_URL>/api/auth/callback/google` to the OAuth client's authorized redirect URIs. Add one for each address you use, such as localhost and the live site.

In MongoDB Atlas, add your server's IP address under Network Access. Render's free plan has no fixed address, so it needs `0.0.0.0/0` (allow from anywhere).

## Put it online

Real-time updates use Socket.IO, which needs a server that stays running, so **this app cannot be hosted on Vercel**. Render, Railway or any VPS will work.

For Render, `render.yaml` is included:

1. Push this project to GitHub.
2. In Render, choose New, then Blueprint, and select the repository.
3. Enter the environment values when asked. `APP_URL` must be the public `https://` address.

A phone can only install the app from an `https://` address, so test installation on the deployed site.

Render's free plan sleeps when idle, which pauses the recurring-transaction and reminder jobs until the next visit. A paid plan keeps them running on schedule.

## Install on a phone

- **Android (Chrome):** open the site, then menu, then Install app.
- **iPhone (Safari):** open the site, tap Share, then Add to Home Screen.

## Features

- **Cash Book:** income and expenses with categories, wallets, tags, notes, attachments, search and filters
- **Budgets:** unlimited, with alerts at 50%, 75%, 90% and over budget, plus a daily allowance and planned-against-actual marker
- **Analytics:** daily, weekly, monthly, yearly and custom charts, averages, records and insights
- **Receipt scanning:** photos and PDFs become an editable table, and nothing is saved until you confirm
- **Shared budgets:** up to 4 people, with roles, permissions, live updates, an activity log and who-owes-whom settlement
- **Assistant:** answers questions from your real data and never changes anything without confirmation
- **Planning:** savings goals, Udhaar, subscriptions, recurring entries, reminders and a calendar view
- **Forecasts:** month-end spending prediction, safe daily limit and unusual-spending alerts
- **Reports:** PDF, Excel and CSV
- **App:** installable PWA with light and dark themes

## Good to know

- **Currency:** each workspace has one currency. Changing it changes the symbol shown and does not convert existing amounts.
- **Shared expenses:** settlement splits a month's expenses equally between current members.
- **PDF reports:** the built-in PDF fonts cover Latin text, so Urdu transaction names print as `?`. Excel and CSV keep them.
- **Offline use:** the app needs a connection. Financial data is never stored on the device.
- **AI privacy:** with a Gemini key, receipts and assistant questions are sent to Google. On Google's free tier they may be used to improve its products, so read Google's Gemini API terms and consider a paid key before storing other people's data.
- **Atlas on some networks:** if the app fails with `queryTxt ETIMEOUT`, your DNS is blocking one of the lookups that `mongodb+srv://` needs. Use the standard `mongodb://` address with the three server names, as `.env.local` does now. Hosting on Render can use either form.
- **Cloudinary links:** images use long unguessable addresses, but anyone who has a link can open it. PDFs open only for signed-in users, through a link that expires after five minutes.
- **Scaling:** rate limits and Socket.IO run in one server process. Running several instances would need a shared store such as Redis.
- **Backups:** turn on backups in MongoDB Atlas. Its free tier does not include them, so export a Complete Cash Book regularly or upgrade before storing real data.

## Project layout

```
app/          Pages and API routes
components/   Shared interface pieces
lib/          Business logic: finance maths, analytics, scanning, assistant, reports
models/       MongoDB schemas
scripts/      Icon generator and end-to-end test
server.js     Next.js and Socket.IO in one process
tests/        Unit tests
```

## Tests

```bash
npm test
```

The end-to-end suite needs a running server and an **empty test database**, because it creates and deletes accounts. `CRON_SECRET_SOURCE` must match the server's `AUTH_SECRET`.

```bash
BASE=http://localhost:3100 CRON_SECRET_SOURCE=<your AUTH_SECRET> npm run e2e
```

To regenerate the app icon and splash screens, edit `scripts/make-icons.mjs` and run `npm run icons`.
