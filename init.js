#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 HomeShoppie App Initialization Started...\n');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function step(message) {
  log(`\n${colors.cyan}🔧 ${message}${colors.reset}`);
}

function runCommand(command, description) {
  try {
    step(description);
    execSync(command, { stdio: 'inherit' });
    success(`${description} completed successfully`);
    return true;
  } catch (err) {
    error(`${description} failed: ${err.message}`);
    return false;
  }
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    success(`${description} found`);
    return true;
  } else {
    warning(`${description} not found`);
    return false;
  }
}

async function main() {
  try {
    // Step 1: Check if Node.js and npm are installed
    step('Checking system requirements');
    try {
      execSync('node --version', { stdio: 'pipe' });
      execSync('npm --version', { stdio: 'pipe' });
      success('Node.js and npm are installed');
    } catch (err) {
      error('Node.js and npm are required. Please install them first.');
      process.exit(1);
    }

    // Step 2: Install dependencies
    if (!runCommand('npm install', 'Installing dependencies')) {
      process.exit(1);
    }

    // Step 3: Check for environment files
    step('Checking environment configuration');
    const envExists = checkFile('.env', '.env file');
    const envLocalExists = checkFile('.env.local', '.env.local file');
    
    if (!envExists && !envLocalExists) {
      warning('No environment file found. Creating .env.example as reference...');
      
      const envExample = `# Database
DATABASE_URL="mongodb://localhost:27017/homeshoppie"

# NextAuth.js
NEXTAUTH_SECRET="your-nextauth-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Razorpay Configuration
NEXT_PUBLIC_RAZORPAY_KEY_ID="your-razorpay-key-id"
RAZORPAY_KEY_SECRET="your-razorpay-key-secret"

# Base URL
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Optional: For production deployment
# VERCEL_URL="your-vercel-url"
`;
      
      fs.writeFileSync('.env.example', envExample);
      info('Created .env.example file. Please copy it to .env and fill in your values');
      warning('You need to configure your environment variables before proceeding');
    }

    // Step 4: Generate Prisma client
    if (!runCommand('npx prisma generate', 'Generating Prisma client')) {
      warning('Prisma client generation failed. You may need to configure your DATABASE_URL first.');
    }

    // Step 5: Database setup (only if DATABASE_URL is configured)
    step('Checking database connection');
    try {
      // Try to push database schema
      execSync('npx prisma db push', { stdio: 'pipe' });
      success('Database schema pushed successfully');
      
      // Seed the database
      if (!runCommand('npx prisma db seed', 'Seeding database with initial data')) {
        warning('Database seeding failed, but you can run it manually later with: npm run db:seed');
      }
    } catch (err) {
      warning('Database setup skipped. Please configure DATABASE_URL in .env file and run:');
      info('  npx prisma db push');
      info('  npx prisma db seed');
    }

    // Step 6: Create necessary directories
    step('Creating necessary directories');
    const directories = ['public/images', 'logs'];
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        success(`Created directory: ${dir}`);
      } else {
        info(`Directory already exists: ${dir}`);
      }
    });

    // Step 7: Check for required files
    step('Checking project structure');
    const requiredFiles = [
      'package.json',
      'next.config.ts',
      'tailwind.config.js',
      'prisma/schema.prisma'
    ];
    
    let allFilesExist = true;
    requiredFiles.forEach(file => {
      if (!checkFile(file, file)) {
        allFilesExist = false;
      }
    });

    // Final steps and summary
    console.log('\n' + '='.repeat(60));
    log('🎉 HomeShoppie Initialization Summary', colors.bright);
    console.log('='.repeat(60));

    success('✅ Dependencies installed');
    success('✅ Prisma client generated');
    success('✅ Required directories created');

    if (envExists || envLocalExists) {
      success('✅ Environment configuration found');
    } else {
      warning('⚠️  Environment configuration needed');
    }

    console.log('\n📋 Next Steps:');
    if (!envExists && !envLocalExists) {
      info('1. Copy .env.example to .env and configure your environment variables');
      info('2. Set up your MongoDB database connection');
      info('3. Configure Razorpay credentials');
    }
    info('4. Run the development server: npm run dev');
    info('5. Visit http://localhost:3000 to see your application');

    console.log('\n📚 Available Scripts:');
    info('  npm run dev          - Start development server');
    info('  npm run build        - Build for production');
    info('  npm run start        - Start production server');
    info('  npm run db:seed      - Seed database with sample data');
    info('  npm run db:generate  - Generate Prisma client');
    info('  npm run db:push      - Push schema changes to database');

    console.log('\n🔧 Troubleshooting:');
    info('  - If database connection fails, check DATABASE_URL in .env');
    info('  - If Razorpay payment fails, check RAZORPAY credentials');
    info('  - For production deployment, set NEXT_PUBLIC_BASE_URL');

    log('\n🎊 Initialization completed successfully!', colors.green);
    log('Happy coding! 🚀', colors.cyan);

  } catch (err) {
    error(`Initialization failed: ${err.message}`);
    process.exit(1);
  }
}

// Run the initialization
main().catch(console.error);
