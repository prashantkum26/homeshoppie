# HomeShoppie 🏠🛒

A full-featured e-commerce platform built with Next.js, featuring traditional homemade products like ghee, oils, sweets, namkeen, and pooja items.

## 🚀 Quick Start

### One-Command Setup

For first-time setup, run our initialization script:

```bash
npm run init
```

This will automatically:
- ✅ Install all dependencies
- ✅ Generate Prisma client
- ✅ Create environment file template
- ✅ Set up database schema
- ✅ Seed sample data
- ✅ Create necessary directories

### Manual Setup

If you prefer manual setup or encounter issues:

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   Configure your environment variables (see [Environment Variables](#environment-variables))

3. **Database Setup**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **npm** (v8 or higher)
- **MongoDB** database (local or cloud)
- **Razorpay** account (for payments)

## 🔧 Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="mongodb://localhost:27017/homeshoppie"
# Or for MongoDB Atlas:
# DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/homeshoppie"

# NextAuth.js
NEXTAUTH_SECRET="your-super-secret-key-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"

# Security
CSRF_SECRET="a-long-random-production-secret"
CRON_SECRET="a-long-random-secret-for-expiry-jobs"

# Razorpay Configuration (Get from Razorpay Dashboard)
# RAZORPAY_KEY_ID is the server-side key. It is required: without it (or
# RAZORPAY_KEY_SECRET) every gateway-backed payment method is reported as
# unavailable and checkout will refuse to create orders.
RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxx"
RAZORPAY_KEY_SECRET="your_razorpay_secret"
# Same key id, exposed to the browser so the checkout widget can open.
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxx"
RAZORPAY_WEBHOOK_SECRET="your_razorpay_webhook_secret"

# Optional: comma-separated payment methods to switch off without a deploy.
# Valid values: card, upi, netbanking, wallet, emandate, nach
# PAYMENT_METHODS_DISABLED="upi"

# Base URL
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Optional: For production deployment
# VERCEL_URL="your-app.vercel.app"
```

`CRON_SECRET` must be configured in production and used by a scheduler to call
`POST /api/cron/release-expired-orders` and
`POST /api/cron/retry-refunds` every few minutes. The first releases stock
reserved by orders whose payment window expired. The second safely reconciles
pending or failed late-payment refunds before attempting them again. Never
expose either secret to the browser or use placeholder values in production.
Generate secrets with a cryptographically secure tool, for example:

```bash
openssl rand -hex 32
```

### Payment methods

The list of payment methods has a single source of truth:
[`src/lib/payment-methods.ts`](src/lib/payment-methods.ts). Every consumer —
the checkout UI, order creation, and Razorpay order creation — resolves
availability through that module, so the list can never drift between the
screen the customer sees and the rules the server enforces.

The catalogue is typed as a total record over the Prisma `PaymentMethod` enum,
so adding a value to the enum fails `npm run type-check` until it is described.
The compiler is the synchronisation mechanism.

A method is offered only when **all** of the following hold:

| Condition | Source |
| --- | --- |
| `enabled` is true in the catalogue | `src/lib/payment-methods.ts` |
| Not listed in `PAYMENT_METHODS_DISABLED` | environment |
| Razorpay credentials are present (gateway methods) | environment |
| The order total is within the method's min/max | catalogue + server-computed total |

Flow:

1. `GET /api/cart/summary` returns `paymentMethods`, resolved against the
   server-computed order total. The checkout page renders exactly this list
   and never filters client-side.
2. `POST /api/orders` re-validates the submitted method against the total it
   computes itself. A stale or tampered selection returns `409` with
   `code: "PAYMENT_METHOD_UNAVAILABLE"`, a machine-readable `reason`, and a
   refreshed `availablePaymentMethods` list. **No order row is created.**
   The checkout page consumes this to re-prompt in place.
3. `POST /api/razorpay/order` re-asserts availability once more, because the
   order row may be minutes old by the time payment starts.

To change what customers can use:

- **Permanently** — edit `enabled` in the catalogue and ship it (reviewable in
  a pull request, covered by tests).
- **Operationally, without a deploy** — set `PAYMENT_METHODS_DISABLED`, e.g.
  `PAYMENT_METHODS_DISABLED="upi,netbanking"`. It is read on every request, so
  it takes effect immediately. Unknown entries are ignored rather than throwing,
  so a typo cannot take checkout down.

Amount limits live in the catalogue too. UPI is capped at ₹1,00,000 to match
NPCI/bank limits, so a high-value cart never reaches the Razorpay modal with a
method that is guaranteed to fail.

### Production security checklist

- Serve the application only over HTTPS and keep HSTS enabled.
- Set `NODE_ENV=production`, `NEXTAUTH_URL`, and `NEXT_PUBLIC_BASE_URL` to the
  exact public HTTPS origin. Do not include a trailing path or alternate origin.
- Store `DATABASE_URL`, `NEXTAUTH_SECRET`, `CSRF_SECRET`, `CRON_SECRET`,
  `RAZORPAY_KEY_SECRET`, and SMTP credentials only in the deployment secret
  manager. Never commit `.env` files or print these values in logs.
- Run behind a trusted reverse proxy that overwrites `x-forwarded-for`,
  `x-real-ip`, and (when applicable) `cf-connecting-ip`; do not expose the
  application server directly to the internet. These headers are used for
  rate limiting and audit records.
- Configure Razorpay webhooks to use the deployed HTTPS webhook URL and verify
  the webhook secret separately from `RAZORPAY_KEY_SECRET`.
- Schedule the expiry endpoint with a server-side `POST` request and the
  `Authorization: Bearer <CRON_SECRET>` header. Do not call it from browser
  JavaScript.
- The `/api/test/*` endpoints return `404` in production. Keep test and seed
  tooling out of production deployments where possible.
- If a customer closes Razorpay before authorization, the checkout calls
  `POST /api/orders/:id/cancel`. The server cancels only an unpaid pending
  order and releases its reserved stock transactionally. Authorized/captured
  payments are never cancelled based only on browser events; Razorpay
  webhooks remain authoritative.
- Razorpay webhook processing uses guarded transactional state transitions.
  Delayed or duplicate payment events cannot resurrect cancelled/failed orders.
  A captured payment received after cancellation is refunded for the exact
  verified gateway amount. Refund IDs, amounts, attempts, timestamps, and
  failures are persisted; ambiguous provider failures remain retryable and are
  reconciled by deterministic receipt before another refund request is sent.
  Only a redacted gateway snapshot is stored; full Razorpay payloads must not be
  logged or persisted.
- Customer and admin cancellation is blocked once shipping or fulfillment has
  started (`SHIPPED`, `DELIVERED`, partial fulfillment, or fulfilled). Use the
  return/refund workflow for shipped orders instead of changing them to
  `CANCELLED`.
- Review admin accounts, rotate secrets after incidents, and monitor failed
  authentication, payment, webhook, and rate-limit events.

### 🔑 Getting Razorpay Credentials

1. Sign up at [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Go to Settings → API Keys
3. Generate Test/Live keys
4. Add them to your `.env` file

## 📚 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run init` | 🚀 **One-time initialization script** |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema changes to database |
| `npm test` | Run tests |
| `npm run type-check` | TypeScript type checking |

## 🛠️ Features

### 🛒 E-commerce Core
- Product catalog with categories
- Shopping cart with persistent storage
- Wishlist functionality
- User authentication & profiles
- Order management system
- Payment integration (Razorpay)

### 💳 Payment Features
- **Professional Payment Flow**: Enhanced error handling with loading states
- **Multiple Payment Methods**: Cards, UPI, Net Banking, Wallets
- **Payment Failure Recovery**: Automatic cart clearing and proper redirect handling
- **Order Tracking**: Users can track failed/cancelled payments

### 🔐 Authentication
- **Enhanced Login Experience**: Redirect URL support with user-friendly notifications
- **Flexible Redirects**: Supports both `callbackUrl` and `redirect` parameters
- **Session Management**: Automatic session sync after login
- **Protected Routes**: Secure checkout and user pages

### 🎨 UI/UX
- Responsive design (Mobile-first)
- Modern Tailwind CSS styling
- Interactive components with Framer Motion
- Toast notifications
- Professional loading states
- Error boundaries

### 🗃️ Database & Backend
- **MongoDB** with Prisma ORM
- **Fixed Database Issues**: Proper foreign key constraint handling
- **Reliable Seeding**: Error-free database initialization
- RESTful API design
- Input validation with Zod
- Comprehensive error handling

## 📁 Project Structure

```
homeshoppie/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   ├── auth/           # Authentication pages
│   │   ├── checkout/       # Checkout flow
│   │   └── ...
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utilities & configurations
│   ├── store/              # Zustand state management
│   └── types/              # TypeScript definitions
├── prisma/                 # Database schema & migrations
├── public/                 # Static assets
├── init.js                 # 🚀 Initialization script
└── package.json
```

## 🚀 Deployment

### Vercel (Recommended)

1. **Prepare for deployment:**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel:**
   ```bash
   npx vercel
   ```

3. **Configure environment variables** in Vercel dashboard

4. **Update environment variables:**
   ```env
   NEXT_PUBLIC_BASE_URL="https://your-app.vercel.app"
   NEXTAUTH_URL="https://your-app.vercel.app"
   ```

### Other Platforms

The app is compatible with:
- **Netlify**
- **Railway**
- **DigitalOcean App Platform**
- **AWS Amplify**

## 🔧 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check your DATABASE_URL in .env
# For local MongoDB:
DATABASE_URL="mongodb://localhost:27017/homeshoppie"

# Restart MongoDB service if needed
```

**Payment Integration Issues**
- Verify Razorpay credentials in `.env`
- Check if you're using test/live keys appropriately
- Ensure webhook URLs are configured in Razorpay dashboard

**Build/Runtime Errors**
```bash
# Clear Next.js cache
npm run cleanup

# Regenerate Prisma client
npm run db:generate

# Check TypeScript errors
npm run type-check
```

**Home Page URL Error**
- Fixed in latest version with proper URL fallback logic
- Ensure `NEXT_PUBLIC_BASE_URL` is set correctly

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 Support

If you encounter any issues:

1. **Run the initialization script**: `npm run init`
2. **Check the troubleshooting section** above
3. **Review environment variables** configuration
4. **Check database connection** and credentials

## 🎉 What's New

### Latest Updates
- ✅ **Professional Payment Error Handling**: Enhanced UX with loading states and proper redirects
- ✅ **Enhanced Login Flow**: Redirect URL support with user notifications  
- ✅ **Database Fixes**: Resolved seed errors and foreign key constraints
- ✅ **URL Resolution**: Fixed home page undefined URL errors
- ✅ **One-Command Setup**: Complete initialization script for easy deployment

### Recent Features
- Professional payment failure recovery flow
- Enhanced login redirect functionality
- Reliable database seeding
- Environment-aware URL construction
- Comprehensive error handling

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using Next.js, MongoDB, and modern web technologies**

🚀 **Get started in seconds with `npm run init`**





mongod --replSet "rs0" --dbpath /data/db --port 27017
rs.initiate()




db.createUser({
  user: "homeshoppie",
  pwd: "Kp26@1995",
  roles: [
    { role: "readWrite", db: "homeshoppie" }
  ]
})

PS C:\Users\prash> Stop-Service MongoDB
PS C:\Users\prash> Start-Service MongoDB