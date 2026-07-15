This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Create a local `.env` or `.env.local` with the server-side secrets required by
the app. Product image uploads use Vercel Blob, so the app must have:

```bash
BLOB_READ_WRITE_TOKEN=your-vercel-blob-read-write-token
```

On Vercel, create or connect a Blob store for this project, then make sure
`BLOB_READ_WRITE_TOKEN` is present for the environments you deploy to
(`Production`, `Preview`, and/or `Development`). You can add it in the Vercel
dashboard under the `glv-management-system` project settings, or with:

```bash
vercel env add BLOB_READ_WRITE_TOKEN production preview development
```

After adding the token, redeploy the app. For local testing, pull the updated
Vercel environment variables or add the same key locally:

```bash
vercel env pull .env.local --yes
```

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
