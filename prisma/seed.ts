import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const categories = [
  {
    name: 'Ghee',
    description: 'Pure homemade ghee varieties made using traditional methods',
    slug: 'ghee',
    image: '/images/category-ghee.jpg'
  },
  {
    name: 'Oils',
    description: 'Cold-pressed oils extracted using traditional sarso mill',
    slug: 'oils',
    image: '/images/category-oils.jpg'
  },
  {
    name: 'Sweets',
    description: 'Traditional sweets and desserts made with authentic recipes',
    slug: 'sweets',
    image: '/images/category-sweets.jpg'
  },
  {
    name: 'Namkeen',
    description: 'Crispy and delicious savory snacks',
    slug: 'namkeen',
    image: '/images/category-namkeen.jpg'
  },
  {
    name: 'Pooja Items',
    description: 'Sacred items for worship and religious ceremonies',
    slug: 'pooja-items',
    image: '/images/category-pooja.jpg'
  }
]

const products = [
  // Ghee Products
  {
    name: 'Pure Cow Ghee',
    description: 'Made from fresh cow milk using traditional bilona method. Rich in vitamins A, D, E, and K. Perfect for cooking, frying, and Ayurvedic remedies.',
    price: 599,
    compareAt: 699,
    images: ['/images/cow-ghee-1.jpg', '/images/cow-ghee-2.jpg'],
    categoryName: 'Ghee',
    stock: 50,
    slug: 'pure-cow-ghee',
    weight: 500,
    unit: 'g',
    tags: ['Organic', 'Traditional', 'A2 Milk', 'Bilona Method']
  },
  {
    name: 'Buffalo Ghee (Bilona)',
    description: 'Premium buffalo ghee made using ancient bilona method. Higher nutritional value with rich taste and aroma. Ideal for traditional cooking.',
    price: 799,
    compareAt: 899,
    images: ['/images/buffalo-ghee-1.jpg', '/images/buffalo-ghee-2.jpg'],
    categoryName: 'Ghee',
    stock: 30,
    slug: 'buffalo-ghee-bilona',
    weight: 500,
    unit: 'g',
    tags: ['Premium', 'Bilona Method', 'High Fat Content', 'Traditional']
  },
  {
    name: 'Mixed Ghee (Cow + Buffalo)',
    description: 'Perfect blend of cow and buffalo ghee combining the best of both. Balanced taste and nutrition for everyday cooking needs.',
    price: 699,
    compareAt: 799,
    images: ['/images/mixed-ghee-1.jpg', '/images/mixed-ghee-2.jpg'],
    categoryName: 'Ghee',
    stock: 40,
    slug: 'mixed-ghee-cow-buffalo',
    weight: 500,
    unit: 'g',
    tags: ['Blended', 'Nutritious', 'Daily Use', 'Economic']
  },

  // Oil Products  
  {
    name: 'Cold-Pressed Mustard Oil',
    description: 'Pure mustard oil extracted using traditional wooden churner. Rich in omega-3 fatty acids and antioxidants. Perfect for cooking and massage.',
    price: 299,
    compareAt: 349,
    images: ['/images/mustard-oil-1.jpg', '/images/mustard-oil-2.jpg'],
    categoryName: 'Oils',
    stock: 60,
    slug: 'cold-pressed-mustard-oil',
    weight: 1,
    unit: 'L',
    tags: ['Cold-Pressed', 'Pure', 'Omega-3', 'Traditional']
  },
  {
    name: 'Organic Sesame Oil',
    description: 'Traditional til oil extracted from premium sesame seeds. Rich in vitamin E and minerals. Great for cooking and skin care.',
    price: 399,
    compareAt: 449,
    images: ['/images/sesame-oil-1.jpg', '/images/sesame-oil-2.jpg'],
    categoryName: 'Oils',
    stock: 35,
    slug: 'organic-sesame-oil',
    weight: 500,
    unit: 'ml',
    tags: ['Organic', 'Vitamin E', 'Skin Care', 'Premium']
  },

  // Sweet Products
  {
    name: 'Traditional Thekua',
    description: 'Authentic Bihar special thekua made with wheat flour, jaggery, and ghee. Perfect for festivals like Chhath Puja and daily snacking.',
    price: 199,
    compareAt: null,
    images: ['/images/thekua-1.jpg', '/images/thekua-2.jpg'],
    categoryName: 'Sweets',
    stock: 80,
    slug: 'traditional-thekua',
    weight: 250,
    unit: 'g',
    tags: ['Handmade', 'Festival Special', 'Chhath Puja', 'Traditional']
  },
  {
    name: 'Gujiya (Karanji)',
    description: 'Delicious sweet dumplings filled with khoya, dry fruits, and coconut. Perfect for Holi and other celebrations.',
    price: 299,
    compareAt: 349,
    images: ['/images/gujiya-1.jpg', '/images/gujiya-2.jpg'],
    categoryName: 'Sweets',
    stock: 45,
    slug: 'gujiya-karanji',
    weight: 250,
    unit: 'g',
    tags: ['Festival Special', 'Holi Special', 'Khoya Filled', 'Handmade']
  },
  {
    name: 'Kheer Mohan',
    description: 'Soft and spongy Bengali sweet soaked in flavored milk. Made with fresh chenna and aromatic cardamom.',
    price: 249,
    compareAt: 299,
    images: ['/images/kheer-mohan-1.jpg', '/images/kheer-mohan-2.jpg'],
    categoryName: 'Sweets',
    stock: 25,
    slug: 'kheer-mohan',
    weight: 200,
    unit: 'g',
    tags: ['Bengali Sweet', 'Milk Based', 'Soft Texture', 'Cardamom']
  },

  // Namkeen Products
  {
    name: 'Mixed Namkeen',
    description: 'Crispy mixture of sev, peanuts, curry leaves, and spices. Perfect tea-time snack with balanced spicy and tangy flavors.',
    price: 149,
    compareAt: 179,
    images: ['/images/mixed-namkeen-1.jpg', '/images/mixed-namkeen-2.jpg'],
    categoryName: 'Namkeen',
    stock: 100,
    slug: 'mixed-namkeen',
    weight: 200,
    unit: 'g',
    tags: ['Crispy', 'Spicy', 'Tea Time', 'Mix Variety']
  },
  {
    name: 'Aloo Bhujia',
    description: 'Crispy potato sticks seasoned with traditional spices. Light, crunchy, and perfectly spiced for snacking anytime.',
    price: 129,
    compareAt: 149,
    images: ['/images/aloo-bhujia-1.jpg', '/images/aloo-bhujia-2.jpg'],
    categoryName: 'Namkeen',
    stock: 75,
    slug: 'aloo-bhujia',
    weight: 150,
    unit: 'g',
    tags: ['Potato Based', 'Crispy', 'Light Spice', 'Crunchy']
  },
  {
    name: 'Masala Makhana',
    description: 'Roasted fox nuts seasoned with aromatic spices. Healthy, low-calorie snack perfect for weight watchers.',
    price: 179,
    compareAt: 199,
    images: ['/images/masala-makhana-1.jpg', '/images/masala-makhana-2.jpg'],
    categoryName: 'Namkeen',
    stock: 60,
    slug: 'masala-makhana',
    weight: 100,
    unit: 'g',
    tags: ['Healthy', 'Low Calorie', 'Protein Rich', 'Roasted']
  },

  // Pooja Items
  {
    name: 'Brass Diya Set',
    description: 'Handcrafted brass diyas perfect for daily worship and festivals. Set of 5 traditional oil lamps with beautiful finish.',
    price: 399,
    compareAt: null,
    images: ['/images/brass-diya-1.jpg', '/images/brass-diya-2.jpg'],
    categoryName: 'Pooja Items',
    stock: 40,
    slug: 'brass-diya-set',
    weight: null,
    unit: 'Set of 5',
    tags: ['Handcrafted', 'Brass', 'Festival Use', 'Traditional']
  },
  {
    name: 'Camphor Tablets',
    description: 'Pure camphor tablets for aarti and worship. Natural and chemical-free with long-lasting fragrance.',
    price: 89,
    compareAt: 99,
    images: ['/images/camphor-1.jpg', '/images/camphor-2.jpg'],
    categoryName: 'Pooja Items',
    stock: 120,
    slug: 'pure-camphor-tablets',
    weight: 50,
    unit: 'g',
    tags: ['Pure', 'Natural', 'Fragrant', 'Worship Essential']
  },
  {
    name: 'Kumkum Sindoor Pack',
    description: 'Traditional kumkum and sindoor made from natural ingredients. Safe for daily use with vibrant red color.',
    price: 149,
    compareAt: 169,
    images: ['/images/kumkum-sindoor-1.jpg', '/images/kumkum-sindoor-2.jpg'],
    categoryName: 'Pooja Items',
    stock: 85,
    slug: 'kumkum-sindoor-pack',
    weight: 25,
    unit: 'g',
    tags: ['Natural', 'Safe', 'Traditional', 'Daily Use']
  }
]

const users = [
  {
    email: 'admin@homeshoppie.com',
    name: 'Admin User',
    password: 'admin123',
    role: 'ADMIN',
    phone: '+91 98765 43210'
  },
  {
    email: 'customer@homeshoppie.com', 
    name: 'Test Customer',
    password: 'password123',
    role: 'USER',
    phone: '+91 98765 43211'
  }
]

async function main() {
  console.log('🌱 Starting database seeding...')

  // Clean up existing data
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.address.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.account.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()

  // Create users
  console.log('👤 Creating users...')
  for (const userData of users) {
    const hashedPassword = await bcrypt.hash(userData.password, 12)
    await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword
      }
    })
  }

  // Create categories
  console.log('📂 Creating categories...')
  for (const categoryData of categories) {
    await prisma.category.create({
      data: categoryData
    })
  }

  // Create products
  console.log('🛍️ Creating products...')
  for (const productData of products) {
    const category = await prisma.category.findUnique({
      where: { name: productData.categoryName }
    })

    if (category) {
      const { categoryName, ...productWithoutCategoryName } = productData
      await prisma.product.create({
        data: {
          ...productWithoutCategoryName,
          categoryId: category.id
        }
      })
    }
  }

  // Create sample addresses
  console.log('🏠 Creating sample addresses...')
  const customer = await prisma.user.findUnique({
    where: { email: 'customer@homeshoppie.com' }
  })

  if (customer) {
    await prisma.address.createMany({
      data: [
        {
          userId: customer.id,
          name: 'Test Customer',
          phone: '+91 98765 43211',
          street: '123 Main Street, Apartment 4B',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          landmark: 'Near City Mall',
          type: 'HOME'
        },
        {
          userId: customer.id,
          name: 'Test Customer',
          phone: '+91 98765 43211',
          street: '456 Office Complex, Floor 12',
          city: 'Mumbai',
          state: 'Maharashtra', 
          pincode: '400002',
          landmark: 'Business District',
          type: 'WORK'
        }
      ]
    })
  }

  console.log('✅ Database seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
