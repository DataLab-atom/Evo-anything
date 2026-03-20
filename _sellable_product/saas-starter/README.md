# SaaS Starter Kit

A production-ready SaaS starter template built with Next.js 14, TypeScript, and modern tooling. Stop wasting weeks on boilerplate -- launch your SaaS product in days, not months.

## What's Included

- **Next.js 14 App Router** with TypeScript and React Server Components
- **Authentication** via NextAuth.js (Google, GitHub, Email magic links)
- **Payments** with Stripe (checkout, subscriptions, webhooks, customer portal)
- **Database** with Prisma ORM and PostgreSQL (User, Team, Subscription models)
- **Email** with Resend for transactional emails (welcome, subscription confirmation)
- **UI Components** built on shadcn/ui + Tailwind CSS
- **Dark/Light Mode** with next-themes
- **Landing Page** with hero, features, pricing, and FAQ sections
- **Dashboard** with sidebar navigation, settings, billing, and team management
- **SEO** with meta tags, Open Graph images, sitemap, and robots.txt
- **Middleware** for route protection
- **Deployment** ready for Vercel

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd saas-starter
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in your values in `.env.local`. See the [Environment Variables](#environment-variables) section below.

### 3. Set up the database

Make sure PostgreSQL is running, then:

```bash
npx prisma db push
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_NAME` | Your app name (displayed in UI) |
| `NEXT_PUBLIC_APP_URL` | Your app URL (e.g., http://localhost:3000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | NextAuth URL (same as app URL) |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Stripe price ID for Pro monthly |
| `STRIPE_PRO_YEARLY_PRICE_ID` | Stripe price ID for Pro yearly |
| `STRIPE_BUSINESS_MONTHLY_PRICE_ID` | Stripe price ID for Business monthly |
| `STRIPE_BUSINESS_YEARLY_PRICE_ID` | Stripe price ID for Business yearly |
| `RESEND_API_KEY` | Resend API key for emails |
| `EMAIL_FROM` | Sender email address |

## Setting Up Providers

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Go to APIs & Services > Credentials
4. Create an OAuth 2.0 Client ID
5. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI

### GitHub OAuth
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set the callback URL to `http://localhost:3000/api/auth/callback/github`

### Stripe
1. Create a [Stripe account](https://stripe.com)
2. Get your API keys from the Stripe Dashboard
3. Create products and prices in Stripe
4. Set up a webhook endpoint pointing to `/api/webhooks/stripe`
5. Listen for: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`

For local development, use the Stripe CLI:
```bash
npm run stripe:listen
```

### Resend
1. Create a [Resend account](https://resend.com)
2. Verify your domain
3. Get your API key

## Project Structure

```
src/
  app/
    api/
      auth/[...nextauth]/  # NextAuth API route
      stripe/
        checkout/           # Stripe checkout session creation
        portal/             # Stripe customer portal
      webhooks/stripe/      # Stripe webhook handler
    dashboard/
      billing/              # Subscription management
      settings/             # User settings
      team/                 # Team management
      layout.tsx            # Dashboard layout with sidebar
      page.tsx              # Dashboard home
    login/                  # Authentication page
    layout.tsx              # Root layout
    page.tsx                # Landing page
    sitemap.ts              # Dynamic sitemap
    robots.ts               # Robots.txt
  components/
    dashboard/              # Dashboard-specific components
    landing/                # Landing page sections
    shared/                 # Shared components (theme toggle, user button)
    ui/                     # Base UI components (shadcn/ui style)
  hooks/                    # Custom React hooks
  lib/
    auth.ts                 # NextAuth configuration
    email.ts                # Resend email helpers
    prisma.ts               # Prisma client singleton
    stripe.ts               # Stripe client and plan definitions
    subscription.ts         # Subscription helpers
    utils.ts                # Utility functions
  types/                    # TypeScript type definitions
  middleware.ts             # Route protection middleware
prisma/
  schema.prisma             # Database schema
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run stripe:listen` | Forward Stripe webhooks locally |

## Deployment

This project is optimized for [Vercel](https://vercel.com):

1. Push your code to a Git repository
2. Import the project in Vercel
3. Add all environment variables
4. Deploy

Remember to update your OAuth callback URLs and Stripe webhook URL to your production domain.

## Customization

### Branding
- Update `NEXT_PUBLIC_APP_NAME` in your environment variables
- Replace the logo in sidebar and header components
- Modify colors in `src/app/globals.css` (CSS variables)
- Update the OG image in `src/app/opengraph-image.tsx`

### Pricing Plans
- Edit plan details in `src/lib/stripe.ts`
- Update the pricing section in `src/components/landing/pricing.tsx`
- Create corresponding products/prices in your Stripe dashboard

### Database
- Modify the schema in `prisma/schema.prisma`
- Run `npx prisma db push` or `npx prisma migrate dev` after changes

## Tech Stack

- [Next.js 14](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [NextAuth.js](https://next-auth.js.org/) - Authentication
- [Prisma](https://www.prisma.io/) - Database ORM
- [Stripe](https://stripe.com/) - Payments
- [Resend](https://resend.com/) - Transactional emails
- [Vercel](https://vercel.com/) - Deployment

## License

MIT
