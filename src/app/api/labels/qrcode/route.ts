import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload =
    req.nextUrl.searchParams.get("payload") ??
    "https://example.com/cacss-library";

  const png = await QRCode.toBuffer(payload, {
    type: "png",
    margin: 1,
    width: 320,
    color: {
      dark: "#143222",
      light: "#ffffffff",
    },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
