const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createUsers() {
  console.log('Creating demo users...')

  try {
    // Create admin user
    const adminPasswordHash = await bcrypt.hash('admin123', 12)
    await prisma.user.create({
      data: {
        email: 'admin@homeshoppie.com',
        name: 'Admin User',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        phone: '+91 98765 43210'
      }
    })

    // Create customer user
    const customerPasswordHash = await bcrypt.hash('password123', 12)
    await prisma.user.create({
      data: {
        email: 'customer@homeshoppie.com',
        name: 'Test Customer',
        passwordHash: customerPasswordHash,
        role: 'USER',
        phone: '+91 98765 43211'
      }
    })

    console.log('✅ Demo users created successfully!')
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('Users already exist.')
    } else {
      console.error('Error creating users:', error)
    }
  } finally {
    await prisma.$disconnect()
  }
}

createUsers()
