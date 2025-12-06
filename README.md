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

# Razorpay Configuration (Get from Razorpay Dashboard)
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxx"
RAZORPAY_KEY_SECRET="your_razorpay_secret"

# Base URL
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Optional: For production deployment
# VERCEL_URL="your-app.vercel.app"
```

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
