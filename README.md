# HomeShoppie - E-Commerce Website

A complete e-commerce website built with Next.js 16+ for selling homemade products like ghee, mustard oil, traditional sweets, and pooja items.

## 🚀 Features

### 🔐 Authentication
- Login/Sign-up pages with NextAuth.js
- JWT-based authentication
- Role-based access (User/Admin)
- Forgot password functionality
- Demo accounts included

### 🏠 Frontend Pages
- Home page with hero carousel and categories
- Category pages with product filtering
- Product listing and details pages
- Shopping cart with local storage
- Checkout process with address management
- User profile and order history
- Admin dashboard (for admin users)

### 🛒 Shopping Features
- Add/remove items from cart
- Update quantities
- Cart persistence with Zustand
- Order management system
- Multiple payment options

### 💳 Payments
- Stripe payment integration ready
- Razorpay integration for India
- Cash on delivery option
- Secure payment processing

### 📦 Product Management
- Category-based organization
- Product search and filtering
- Stock management
- Image galleries
- Rating and review system

## 🛠️ Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Frontend**: React 19+, TailwindCSS
- **Database**: MongoDB with Prisma ORM
- **Authentication**: NextAuth.js
- **State Management**: Zustand
- **Payments**: Stripe, Razorpay
- **UI Components**: Heroicons, React Hot Toast
- **Animations**: Framer Motion

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ installed
- MongoDB database (local or cloud)
- Git installed

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd homeshoppie
```

### 2. Install Dependencies
```bash
pnpm install
# or
npm install
```

### 3. Environment Setup
Copy `.env.local` and update with your values:

```env
# Database
DATABASE_URL="mongodb://localhost:27017/homeshoppie"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Stripe (for payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_your_stripe_publishable_key"
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"

# Razorpay (Alternative for India)
NEXT_PUBLIC_RAZORPAY_KEY_ID="your_razorpay_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_key_secret"
```

### 4. Database Setup
```bash
# Generate Prisma client
pnpm db:generate

# Push database schema
pnpm db:push

# Seed database with sample data
pnpm db:seed
```

### 5. Start Development Server
```bash
pnpm dev
```

Visit `http://localhost:3000` to see your application.

## 🔑 Demo Accounts

### Customer Account
- **Email**: customer@homeshoppie.com
- **Password**: password123

### Admin Account
- **Email**: admin@homeshoppie.com
- **Password**: admin123

## 📁 Project Structure

```
homeshoppie/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── auth/              # Authentication pages
│   │   ├── cart/              # Shopping cart
│   │   ├── api/               # API routes
│   │   └── globals.css        # Global styles
│   └── components/            # Reusable components
├── lib/                       # Utility libraries
├── store/                     # Zustand state management
├── prisma/                    # Database schema and seed
├── public/                    # Static assets
└── README.md
```

## 🎯 Sample Products

The application comes with pre-seeded data including:

### Ghee Products
- Pure Cow Ghee (₹599)
- Buffalo Ghee Bilona (₹799)
- Mixed Ghee (₹699)

### Oils
- Cold-Pressed Mustard Oil (₹299)
- Organic Sesame Oil (₹399)

### Traditional Sweets
- Traditional Thekua (₹199)
- Gujiya/Karanji (₹299)
- Kheer Mohan (₹249)

### Namkeen
- Mixed Namkeen (₹149)
- Aloo Bhujia (₹129)
- Masala Makhana (₹179)

### Pooja Items
- Brass Diya Set (₹399)
- Camphor Tablets (₹89)
- Kumkum Sindoor Pack (₹149)

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically

### Other Platforms
- **Netlify**: Configure build settings
- **Railway**: Connect MongoDB and deploy
- **Heroku**: Add MongoDB addon

## 🔧 Configuration

### Payment Setup

#### Stripe
1. Create Stripe account
2. Get publishable and secret keys
3. Update environment variables
4. Test with Stripe test cards

#### Razorpay (for India)
1. Create Razorpay account
2. Get API keys from dashboard
3. Update environment variables
4. Configure webhook endpoints

### Database Options

#### MongoDB Atlas (Cloud)
```env
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/homeshoppie"
```

#### Local MongoDB
```env
DATABASE_URL="mongodb://localhost:27017/homeshoppie"
```

## 📱 Mobile Responsive

The application is fully responsive and works seamlessly on:
- Desktop computers
- Tablets
- Mobile phones
- All screen sizes

## 🎨 Customization

### Styling
- Uses TailwindCSS for styling
- Custom color scheme in `tailwind.config.js`
- Component-based CSS classes in `globals.css`

### Branding
- Update logo and brand colors
- Modify hero section content
- Customize footer information

## 🔐 Security Features

- Password hashing with bcrypt
- JWT token authentication
- CSRF protection
- Input validation
- Secure payment processing

## 📊 Performance

- Server-side rendering with Next.js
- Image optimization
- Code splitting
- Lazy loading
- Caching strategies

## 🐛 Troubleshooting

### Common Issues

**Database Connection**
```bash
# Check MongoDB is running
mongosh

# Regenerate Prisma client
pnpm db:generate
```

**Authentication Issues**
```bash
# Clear browser cookies and localStorage
# Verify NEXTAUTH_SECRET is set
# Check database user records
```

**Build Errors**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support and questions:
- Email: info@homeshoppie.com
- Phone: +91 98765 43210

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Prisma for database management
- TailwindCSS for styling system
- NextAuth.js for authentication

---

**Happy Shopping with HomeShoppie! 🛒**





To Run Local:

    net stop MongoDB

    mongod --dbpath "C:/data/db" --replSet rs0

    mongosh:

        rs.initiate()
