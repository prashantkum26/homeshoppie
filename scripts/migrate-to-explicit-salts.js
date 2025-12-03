const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const prisma = new PrismaClient()

async function migrateUsersToExplicitSalts() {
  console.log('🔄 Starting migration to explicit password salts...')

  try {
    // Find all users without explicit salts (but with password hashes)
    const usersToMigrate = await prisma.user.findMany({
      where: {
        passwordHash: { not: null },
        passwordSalt: null
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        passwordSalt: true
      }
    })

    console.log(`📊 Found ${usersToMigrate.length} users to migrate`)

    if (usersToMigrate.length === 0) {
      console.log('✅ No users need migration. All users already have explicit salts.')
      return
    }

    let migratedCount = 0
    let errorCount = 0

    for (const user of usersToMigrate) {
      try {
        console.log(`🔄 Migrating user: ${user.email}`)

        // Note: We cannot reverse-engineer the original password from bcrypt hash
        // So we need to prompt these users to reset their passwords
        // For now, we'll generate a salt and mark them for password reset

        // Generate new salt
        const newSalt = crypto.randomBytes(32).toString('hex')

        // Update user with salt but keep existing hash 
        // (they'll need to reset password to use new salt system)
        await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordSalt: newSalt,
            // Mark for password reset by setting a flag or sending reset email
            // For this migration, we'll just add the salt
          }
        })

        migratedCount++
        console.log(`✅ Migrated user: ${user.email}`)

      } catch (error) {
        console.error(`❌ Failed to migrate user ${user.email}:`, error.message)
        errorCount++
      }
    }

    console.log(`\n📈 Migration Summary:`)
    console.log(`   ✅ Successfully migrated: ${migratedCount} users`)
    console.log(`   ❌ Failed migrations: ${errorCount} users`)
    console.log(`   📧 Users may need to reset passwords to use new salt system`)
    
    if (migratedCount > 0) {
      console.log(`\n⚠️  Important Note:`)
      console.log(`   Users migrated will need to reset their passwords`)
      console.log(`   Their old passwords will still work (backward compatibility)`)
      console.log(`   But new passwords will use the explicit salt system`)
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration if script is called directly
if (require.main === module) {
  migrateUsersToExplicitSalts()
}

module.exports = { migrateUsersToExplicitSalts }
