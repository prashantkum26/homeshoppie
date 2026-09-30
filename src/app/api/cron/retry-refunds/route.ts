import { NextRequest, NextResponse } from "next/server";
import { processLatePaymentRefund } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";

const PROCESSING_TIMEOUT_MINUTES = 10;
const BATCH_SIZE = 50;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret) {
    return NextResponse.json(
      { error: "Cron endpoint is not configured" },
      { status: 503 }
    );
  }

  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staleBefore = new Date(
    Date.now() - PROCESSING_TIMEOUT_MINUTES * 60 * 1000
  );
  const refunds = await prisma.paymentLog.findMany({
    where: {
      razorpayPaymentId: { not: null },
      refundAmount: { not: null },
      OR: [
        { refundStatus: { in: ["PENDING", "FAILED"] } },
        {
          refundStatus: "PROCESSING",
          OR: [
            { refundLastAttemptAt: null },
            { refundLastAttemptAt: { lt: staleBefore } },
          ],
        },
      ],
    },
    select: { id: true },
    orderBy: { refundRequestedAt: "asc" },
    take: BATCH_SIZE,
  });

  const results = {
    checked: refunds.length,
    attempted: 0,
    pending: 0,
    succeeded: 0,
    failed: 0,
    errors: 0,
  };

  for (const refund of refunds) {
    try {
      const result = await processLatePaymentRefund(refund.id);
      if (result.attempted) results.attempted += 1;
      if (result.status === "PENDING") results.pending += 1;
      if (result.status === "SUCCEEDED") results.succeeded += 1;
      if (result.status === "FAILED") results.failed += 1;
    } catch (error: unknown) {
      results.errors += 1;
      console.error(
        "Late-payment refund retry failed:",
        error instanceof Error ? error.message : "unknown error"
      );
    }
  }

  return NextResponse.json(results, {
    status: results.errors > 0 ? 500 : 200,
  });
}
