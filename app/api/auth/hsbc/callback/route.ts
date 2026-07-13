import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const incomingUrl = new URL(request.url);
  const code = incomingUrl.searchParams.get("code");
  const state = incomingUrl.searchParams.get("state");
  const error = incomingUrl.searchParams.get("error");
  const errorDescription = incomingUrl.searchParams.get("error_description");

  const redirectToBank = (status: "callback-received" | "error" | "invalid-callback") => {
    const redirectUrl = new URL("/bank", incomingUrl);
    redirectUrl.searchParams.set("hsbc", status);
    return NextResponse.redirect(redirectUrl);
  };

  if (error || errorDescription) {
    return redirectToBank("error");
  }

  if (code && state) {
    // Do not log or expose the full authorisation code.
    // Before enabling a real production banking connection, validate the returned state
    // against the original consent request and exchange the code securely server-side.
    return redirectToBank("callback-received");
  }

  // Missing callbacks are treated as invalid until proper Open Banking state validation
  // and token exchange are implemented.
  return redirectToBank("invalid-callback");
}
