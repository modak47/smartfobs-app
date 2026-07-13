import HomePage from "../page";

type HsbcCallbackStatus = "callback-received" | "error" | "invalid-callback";
type BankFilters = {
  search: string;
  dateFrom: string;
  dateTo: string;
  direction: "all" | "in" | "out";
  category: string;
  reviewStatus: "all" | "needs_review" | "rule_applied" | "reviewed";
  match: "all" | "matched" | "unmatched";
  importBatch: string;
  sort: "newest" | "oldest" | "highest" | "lowest";
};

function getHsbcStatus(value: string | string[] | undefined): HsbcCallbackStatus | null {
  const status = Array.isArray(value) ? value[0] : value;
  if (status === "callback-received" || status === "error" || status === "invalid-callback") {
    return status;
  }
  return null;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getInitialBankFilters(params: {
  dateFrom?: string | string[];
  dateTo?: string | string[];
  reviewStatus?: string | string[];
  category?: string | string[];
  matched?: string | string[];
  direction?: string | string[];
}): BankFilters {
  const reviewStatus = first(params.reviewStatus);
  const matched = first(params.matched);
  const direction = first(params.direction);

  return {
    search: "",
    dateFrom: first(params.dateFrom) || "",
    dateTo: first(params.dateTo) || "",
    direction: direction === "in" || direction === "out" ? direction : "all",
    category: first(params.category) || "all",
    reviewStatus: reviewStatus === "unreviewed" ? "needs_review" : reviewStatus === "needs_review" || reviewStatus === "rule_applied" || reviewStatus === "reviewed" ? reviewStatus : "all",
    match: matched === "true" ? "matched" : matched === "false" ? "unmatched" : "all",
    importBatch: "all",
    sort: "newest",
  };
}

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{
    hsbc?: string | string[];
    dateFrom?: string | string[];
    dateTo?: string | string[];
    reviewStatus?: string | string[];
    category?: string | string[];
    matched?: string | string[];
    direction?: string | string[];
  }>;
}) {
  const params = await searchParams;

  return <HomePage initialView="bank" initialHsbcStatus={getHsbcStatus(params.hsbc)} initialBankFilters={getInitialBankFilters(params)} />;
}
