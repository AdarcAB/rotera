import { NextRequest, NextResponse } from "next/server";
import { consumeLoginToken, setSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=Saknar+token", req.url));
  }
  const userId = await consumeLoginToken(token);
  if (!userId) {
    return NextResponse.redirect(
      new URL("/login?error=Ogiltig+eller+förbrukad+länk", req.url)
    );
  }
  await setSession(userId);
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
