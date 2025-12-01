const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupDuplicatePaymentIds() {
  try {
    console.log('Starting cleanup of duplicate razorpayPaymentId records...');

    // Find all duplicate razorpayPaymentId records
    const duplicatePaymentIds = await prisma.paymentLog.groupBy({
      by: ['razorpayPaymentId'],
      where: {
        razorpayPaymentId: { not: null }
      },
      having: {
        razorpayPaymentId: {
          _count: {
            gt: 1
          }
        }
      },
      _count: {
        razorpayPaymentId: true
      }
    });

    console.log(`Found ${duplicatePaymentIds.length} duplicate payment IDs`);

    if (duplicatePaymentIds.length === 0) {
      console.log('No duplicate payment IDs found. Database is clean.');
      return;
    }

    // For each duplicate, keep the latest one and clear the others
    for (const duplicate of duplicatePaymentIds) {
      const paymentId = duplicate.razorpayPaymentId;
      console.log(`Processing duplicate payment ID: ${paymentId}`);

      // Get all records with this payment ID, ordered by creation date
      const duplicateRecords = await prisma.paymentLog.findMany({
        where: { razorpayPaymentId: paymentId },
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { orderNumber: true } } }
      });

      console.log(`  Found ${duplicateRecords.length} records for payment ID ${paymentId}`);

      // Keep the first (latest) record, clear razorpayPaymentId from the rest
      for (let i = 1; i < duplicateRecords.length; i++) {
        const recordToUpdate = duplicateRecords[i];
        
        console.log(`  Clearing payment ID from record ${recordToUpdate.id} (order: ${recordToUpdate.order.orderNumber})`);
        
        await prisma.paymentLog.update({
          where: { id: recordToUpdate.id },
          data: {
            razorpayPaymentId: null,
            failureReason: `Duplicate payment ID cleared during cleanup - original kept in latest record`
          }
        });
      }
    }

    console.log('Cleanup completed successfully!');

  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  cleanupDuplicatePaymentIds()
    .then(() => {
      console.log('Cleanup script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupDuplicatePaymentIds };
