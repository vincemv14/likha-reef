import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const sql = getDb();
    await sql`DELETE FROM creatures`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting all creatures:", error);
    return NextResponse.json(
      { error: "Failed to delete all creatures" },
      { status: 500 }
    );
  }
}
