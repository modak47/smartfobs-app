import HomePage from "../page";

type HsbcCallbackStatus = "callback-received" | "error" | "invalid-callback";

function getHsbcStatus(value: string | string[] | undefined): HsbcCallbackStatus | null {
  const status = Array.isArray(value) ? value[0] : value;
  if (status === "callback-received" || status === "error" || status === "invalid-callback") {
    return status;
  }
  return null;
}

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ hsbc?: string | string[] }>;
}) {
  const params = await searchParams;

  return <HomePage initialView="bank" initialHsbcStatus={getHsbcStatus(params.hsbc)} />;
}
