# WhatsApp Bulk Sender

Local Electron + Next.js desktop app for sending WhatsApp text and image campaigns to your own expected contacts through Baileys.

## Warning

Baileys is an unofficial WhatsApp Web client. WhatsApp can ban numbers used for unsolicited or high-volume automation. This app includes random delays, confirmation warnings, duplicate cleanup, and self-send prevention, but those do not make cold bulk messaging safe.

## Setup

1. Install Node 20+.
2. Run `npm install`.
3. Create a Supabase project.
4. Run the SQL schema from the project brief in the Supabase SQL Editor.
5. Create public Storage buckets named `campaign-images` and `template-images`.
6. Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_PIN=1234
```

The complete SQL is also available in `supabase/schema.sql`. It includes the campaign tables, Storage policies, and a plain-text `pins` table seeded with `1234`.

7. Start development with `npm run dev`.
8. Click Connect, then scan the QR from WhatsApp Settings -> Linked Devices -> Link a Device.
9. Build an installer with `npm run build`.

## Scripts

- `npm run dev` runs Next.js and Electron together.
- `npm run dev:next` runs only the Next.js server.
- `npm run dev:electron` opens Electron after localhost is ready.
- `npm run build:next` checks the Next.js production build.
- `npm run build` builds Next.js and packages Electron.

## Electron behavior

- Dev mode expects Next.js at `http://localhost:3000`; `npm run dev` starts both processes.
- Production mode starts the bundled Next.js server from Electron, waits for localhost, then opens the desktop window.
- The app enforces a single running instance. Opening it again focuses the existing window.
- External links are opened in the system browser.
- WhatsApp session files are stored in Electron's user data folder in production and `./auth_session` during local Next.js-only development.

## Notes

- The PIN gate is client-side only. It is a local safety latch, not real authentication.
- `auth_session/` stores the WhatsApp linked-device session in development and is gitignored.
- Logout deletes `auth_session/`, so the next connect shows a fresh QR.
