const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupPaymentLogs() {
  console.log('🔧 Cleaning up PaymentLog data for schema migration...');
  
  try {
    // Find all payment logs with null razorpayPaymentId
    const nullPaymentIdLogs = await prisma.paymentLog.findMany({
      where: {
        razorpayPaymentId: null
      }
    });
    
    console.log(`Found ${nullPaymentIdLogs.length} payment logs with null razorpayPaymentId`);
    
    // Remove duplicate/incomplete payment logs
    // Keep only the latest attempt per order
    const ordersWithMultipleLogs = {};
    
    for (const log of nullPaymentIdLogs) {
      if (!ordersWithMultipleLogs[log.orderId]) {
        ordersWithMultipleLogs[log.orderId] = [];
      }
      ordersWithMultipleLogs[log.orderId].push(log);
    }
    
    let deletedCount = 0;
    
    for (const [orderId, logs] of Object.entries(ordersWithMultipleLogs)) {
      if (logs.length > 1) {
        // Sort by createdAt desc and keep only the latest
        logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const toDelete = logs.slice(1); // Remove all except the first (latest)
        
        for (const logToDelete of toDelete) {
          await prisma.paymentLog.delete({
            where: { id: logToDelete.id }
          });
          deletedCount++;
        }
      }
    }
    
    console.log(`✅ Deleted ${deletedCount} duplicate payment log entries`);
    
    // Update remaining null razorpayPaymentId records to be non-null temporarily
    const remainingNulls = await prisma.paymentLog.findMany({
      where: {
        razorpayPaymentId: null,
        status: { not: 'PAID' }
      }
    });
    
    let updatedCount = 0;
    for (const log of remainingNulls) {
      // Set a temporary unique value for incomplete payments
      await prisma.paymentLog.update({
        where: { id: log.id },
        data: {
          razorpayPaymentId: `temp_${log.id}_${Date.now()}`
        }
      });
      updatedCount++;
    }
    
    console.log(`✅ Updated ${updatedCount} incomplete payment logs with temporary payment IDs`);
    
    // Final verification
    const finalNulls = await prisma.paymentLog.count({
      where: {
        razorpayPaymentId: null
      }
    });
    
    if (finalNulls === 0) {
      console.log('✅ All PaymentLog records now have non-null razorpayPaymentId values');
    } else {
      console.warn(`⚠️ Still have ${finalNulls} records with null razorpayPaymentId`);
    }
    
    console.log('🎉 PaymentLog cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during PaymentLog cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupPaymentLogs().catch(console.error);
