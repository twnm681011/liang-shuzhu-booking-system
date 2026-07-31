import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CARD_ALIAS_HOST = "liang-shuzhu-card.vercel.app";

export function proxy(request: NextRequest) {
  // 電子名片專屬網址：根目錄直接顯示名片頁內容
  if (request.nextUrl.pathname === "/" && request.headers.get("host") === CARD_ALIAS_HOST) {
    return NextResponse.rewrite(new URL("/card", request.url));
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.next();
  }
  const user = process.env.ADMIN_USER || "admin";

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
    const separatorIndex = decoded.indexOf(":");
    const inputUser = decoded.slice(0, separatorIndex);
    const inputPass = decoded.slice(separatorIndex + 1);
    if (inputUser === user && inputPass === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("請輸入後台管理密碼", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
  });
}

export const config = {
  matcher: ["/", "/admin/:path*", "/api/appointments/:path*"],
};
