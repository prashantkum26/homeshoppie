import { razorpay } from "@/lib/razorpay";
import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  try {
    const { amount, receipt } = await req.json();

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: receipt || `receipt_${Date.now()}`
    });

    return NextResponse.json(order);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
