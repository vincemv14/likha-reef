import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import cloudinary from "@/lib/cloudinary";

export const runtime = "nodejs";
export const maxDuration = 30;

// Next.js App Router doesn't have a built-in bodyParser limit config like Pages Router.
// Vercel serverless functions support up to 4.5MB request body by default which covers our use case.

export async function GET() {
  try {
    const sql = getDb();
    const creatures = await sql`
      SELECT id, nickname, image_url, color_palette, swim_speed, depth_layer, 
             start_x, start_y, wiggle_amplitude, direction, created_at
      FROM creatures
      ORDER BY created_at DESC
      LIMIT 200
    `;
    return NextResponse.json({ creatures });
  } catch (error) {
    console.error("Error fetching creatures:", error);
    return NextResponse.json(
      { error: "Failed to fetch creatures", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageData, nickname } = body;

    if (!imageData) {
      return NextResponse.json(
        { error: "imageData is required" },
        { status: 400 }
      );
    }

    // Validate env vars
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error("Missing Cloudinary environment variables");
      return NextResponse.json(
        { error: "Server misconfiguration: missing Cloudinary credentials" },
        { status: 500 }
      );
    }

    if (!process.env.DATABASE_URL) {
      console.error("Missing DATABASE_URL environment variable");
      return NextResponse.json(
        { error: "Server misconfiguration: missing database URL" },
        { status: 500 }
      );
    }

    // Upload processed image to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(imageData, {
      folder: "likha-reef/creatures",
      format: "png",
      resource_type: "image",
    });

    // Generate random swim behavior
    const swimSpeed = 0.5 + Math.random() * 2.0;
    const depthLayer = Math.floor(Math.random() * 3) + 1; // 1-3
    const startX = Math.random();
    const startY = 0.2 + Math.random() * 0.6; // keep in middle 60%
    const wiggleAmplitude = 0.5 + Math.random() * 1.5;
    const direction = Math.random() > 0.5 ? 1 : -1;

    const sql = getDb();
    const result = await sql`
      INSERT INTO creatures (nickname, image_url, swim_speed, depth_layer, start_x, start_y, wiggle_amplitude, direction)
      VALUES (${nickname || null}, ${uploadResult.secure_url}, ${swimSpeed}, ${depthLayer}, ${startX}, ${startY}, ${wiggleAmplitude}, ${direction})
      RETURNING id, nickname, image_url, swim_speed, depth_layer, start_x, start_y, wiggle_amplitude, direction, created_at
    `;

    return NextResponse.json({ creature: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating creature:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to create creature", details: message },
      { status: 500 }
    );
  }
}
