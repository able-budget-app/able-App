// Shared Plaid HTTP client + types for Able's edge functions.
// Direct fetch (no SDK) to keep Deno bundles lean.
//
// Required env vars (set as Supabase Edge Function secrets):
//   PLAID_CLIENT_ID
//   PLAID_SECRET
//   PLAID_ENV         — "sandbox" | "development" | "production"
//   PLAID_WEBHOOK_URL — full URL of your plaid-webhook function (optional;
//                       if unset, Link tokens are created without a webhook)

const PLAID_ENV = Deno.env.get('PLAID_ENV') ?? 'sandbox';

const PLAID_HOSTS: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
};

export const PLAID_HOST = PLAID_HOSTS[PLAID_ENV] ?? PLAID_HOSTS.sandbox;

export type PlaidError = {
  error_type: string;
  error_code: string;
  error_message: string;
  display_message?: string | null;
  request_id?: string;
};

export class PlaidApiError extends Error {
  status: number;
  plaid: PlaidError;

  constructor(status: number, plaid: PlaidError) {
    super(`Plaid ${plaid.error_code}: ${plaid.error_message}`);
    this.status = status;
    this.plaid = plaid;
  }
}

// Generic POST. Throws PlaidApiError on non-2xx.
export async function plaidApi<TReq extends Record<string, unknown>, TRes>(
  path: string,
  body: TReq,
): Promise<TRes> {
  const clientId = Deno.env.get('PLAID_CLIENT_ID');
  const secret = Deno.env.get('PLAID_SECRET');
  if (!clientId || !secret) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set');
  }

  const res = await fetch(`${PLAID_HOST}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body. Surface as a generic error below.
  }

  if (!res.ok) {
    const err = (json ?? {
      error_type: 'API_ERROR',
      error_code: 'UNKNOWN',
      error_message: text || `HTTP ${res.status}`,
    }) as PlaidError;
    throw new PlaidApiError(res.status, err);
  }

  return json as TRes;
}

// ─── Common types ──────────────────────────────────────────────────────

export type PlaidAccount = {
  account_id: string;
  name: string | null;
  official_name: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  balances: {
    available: number | null;
    current: number | null;
    iso_currency_code: string | null;
    unofficial_currency_code: string | null;
    limit: number | null;
  };
};

export type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
  date: string;
  authorized_date: string | null;
  name: string;
  merchant_name: string | null;
  pending: boolean;
  personal_finance_category?: {
    primary: string;
    detailed: string;
    confidence_level: string;
  } | null;
};

export type RecurringStream = {
  stream_id: string;
  account_id: string;
  category: string[];
  category_id: string | null;
  description: string;
  merchant_name: string | null;
  first_date: string;
  last_date: string;
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY' | 'ANNUALLY' | 'UNKNOWN';
  transaction_ids: string[];
  average_amount: { amount: number; iso_currency_code: string | null };
  last_amount: { amount: number; iso_currency_code: string | null };
  is_active: boolean;
  is_user_modified: boolean;
  last_user_modified_datetime: string | null;
  status: 'MATURE' | 'EARLY_DETECTION' | 'TOMBSTONED' | 'UNKNOWN';
  predicted_next_date: string | null;
  personal_finance_category?: {
    primary: string;
    detailed: string;
    confidence_level: string;
  } | null;
};

// ─── Endpoint helpers ─────────────────────────────────────────────────

export type LinkTokenCreateReq = {
  user: { client_user_id: string };
  client_name: string;
  products: string[];
  country_codes: string[];
  language: string;
  webhook?: string;
  access_token?: string; // for update mode
  transactions?: { days_requested: number };
};

export type LinkTokenCreateRes = {
  link_token: string;
  expiration: string;
  request_id: string;
};

export const linkTokenCreate = (req: LinkTokenCreateReq) =>
  plaidApi<LinkTokenCreateReq, LinkTokenCreateRes>('/link/token/create', req);

export type ItemPublicTokenExchangeRes = {
  access_token: string;
  item_id: string;
  request_id: string;
};

export const itemPublicTokenExchange = (public_token: string) =>
  plaidApi<{ public_token: string }, ItemPublicTokenExchangeRes>(
    '/item/public_token/exchange',
    { public_token },
  );

export type TransactionsSyncReq = {
  access_token: string;
  cursor?: string;
  count?: number;
  options?: {
    include_personal_finance_category?: boolean;
    days_requested?: number;
  };
};

export type TransactionsSyncRes = {
  accounts: PlaidAccount[];
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: { transaction_id: string; account_id: string }[];
  next_cursor: string;
  has_more: boolean;
  transactions_update_status?: 'NOT_READY' | 'INITIAL_UPDATE_COMPLETE' | 'HISTORICAL_UPDATE_COMPLETE';
  request_id: string;
};

export const transactionsSync = (req: TransactionsSyncReq) =>
  plaidApi<TransactionsSyncReq, TransactionsSyncRes>('/transactions/sync', req);

export type AccountsGetRes = {
  accounts: PlaidAccount[];
  item: { item_id: string; institution_id: string | null };
  request_id: string;
};

export const accountsGet = (access_token: string) =>
  plaidApi<{ access_token: string }, AccountsGetRes>('/accounts/get', { access_token });

export type ItemGetRes = {
  item: {
    item_id: string;
    institution_id: string | null;
    webhook: string | null;
    error: PlaidError | null;
    consent_expiration_time: string | null;
    products: string[];
    billed_products: string[];
  };
  request_id: string;
};

export const itemGet = (access_token: string) =>
  plaidApi<{ access_token: string }, ItemGetRes>('/item/get', { access_token });

export const itemRemove = (access_token: string) =>
  plaidApi<{ access_token: string }, { request_id: string }>('/item/remove', { access_token });

export type TransactionsRecurringGetRes = {
  inflow_streams: RecurringStream[];
  outflow_streams: RecurringStream[];
  updated_datetime: string;
  request_id: string;
};

export const transactionsRecurringGet = (access_token: string, account_ids?: string[]) =>
  plaidApi<{ access_token: string; account_ids?: string[] }, TransactionsRecurringGetRes>(
    '/transactions/recurring/get',
    account_ids ? { access_token, account_ids } : { access_token },
  );

// ─── Institution name lookup ──────────────────────────────────────────

export type InstitutionsGetByIdRes = {
  institution: {
    institution_id: string;
    name: string;
    products: string[];
    country_codes: string[];
    url?: string | null;
    primary_color?: string | null;
    logo?: string | null;
  };
  request_id: string;
};

export const institutionsGetById = (institution_id: string, country_codes: string[] = ['US']) =>
  plaidApi<
    { institution_id: string; country_codes: string[] },
    InstitutionsGetByIdRes
  >('/institutions/get_by_id', { institution_id, country_codes });
