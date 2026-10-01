// Read-only Contractors Cloud client used by Claim Lookup. Server-side only:
// the API token is read from the environment here and never sent to the
// browser. Nothing returned from Contractors Cloud is written to disk.
//
// Configuration (set in the hosting platform's dashboard, see .env.example):
//   CC_API_TOKEN             — an API access token created in Contractors Cloud
//                              under Integrations → API Access Tokens. Create it
//                              from a user whose permissions are the ceiling
//                              of what the team should see.
//   CC_API_BASE_URL          — REST API base URL (default below). Confirm
//                              against api.contractorscloud.com/docs.
//   CC_PROJECT_URL_TEMPLATE  — optional link to open a project in the
//                              Contractors Cloud web app, e.g.
//                              https://<your-subdomain>.contractorscloud.com/projects/{id}
//                              ({id}, {hash} and {number} are substituted).

const DEFAULT_BASE_URL = "https://api.contractorscloud.com/api/v1";

export interface ClaimSummary {
  id: number;
  number: string | null;
  client: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string | null;
  milestone: string | null;
  rep: string | null;
  updatedAt: string | null;
  ccUrl: string | null;
}

export class ContractorsCloudError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export function isContractorsCloudConfigured(): boolean {
  return Boolean(process.env.CC_API_TOKEN);
}

function baseUrl(): string {
  return (process.env.CC_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

async function ccGet(path: string, params: Record<string, string>): Promise<any> {
  const token = process.env.CC_API_TOKEN;
  if (!token) {
    throw new ContractorsCloudError(
      "Contractors Cloud isn't connected yet. An admin needs to set CC_API_TOKEN (see README).",
      503
    );
  }

  const url = new URL(baseUrl() + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ContractorsCloudError("Couldn't reach Contractors Cloud. Try again in a minute.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new ContractorsCloudError(
      "Contractors Cloud rejected the API token. An admin should check CC_API_TOKEN."
    );
  }
  if (res.status === 404) {
    throw new ContractorsCloudError(
      "Contractors Cloud returned 404. An admin should check CC_API_BASE_URL against api.contractorscloud.com/docs."
    );
  }
  if (!res.ok) {
    throw new ContractorsCloudError(`Contractors Cloud returned an error (${res.status}).`);
  }
  return res.json();
}

function projectUrl(p: any): string | null {
  const template = process.env.CC_PROJECT_URL_TEMPLATE;
  if (!template) return null;
  return template
    .replace("{id}", encodeURIComponent(String(p.id)))
    .replace("{hash}", encodeURIComponent(p.hash ?? ""))
    .replace("{number}", encodeURIComponent(p.number ?? ""));
}

function toSummary(p: any): ClaimSummary {
  return {
    id: p.id,
    number: p.number && p.number !== "Lead" ? p.number : null,
    client: p.account_name || p.account?.name || "Unknown client",
    address: [p.address_street, p.address_city, p.address_state, p.address_zip]
      .filter(Boolean)
      .join(", "),
    city: p.address_city || null,
    state: p.address_state || null,
    zip: p.address_zip || null,
    status: p.status?.name ?? null,
    milestone: p.current_project_milestone?.name?.replace(/^\*/, "") ?? null,
    rep: p.rep_primary_name ?? null,
    updatedAt: p.updated_at ?? null,
    ccUrl: projectUrl(p),
  };
}

const INCLUDE = "status,current_project_milestone";

// Matches client name, address, project number, and contact names — the same
// search the Contractors Cloud whiteboard uses.
export async function searchClaims(query: string, limit = 10): Promise<ClaimSummary[]> {
  const json = await ccGet("/projects", {
    "filter[search]": query,
    include: INCLUDE,
    "page[size]": String(limit),
  });
  return (json?.data ?? []).map(toSummary);
}

export async function getClaim(id: number): Promise<ClaimSummary | null> {
  const json = await ccGet("/projects", {
    "filter[id]": String(id),
    include: INCLUDE,
    "page[size]": "1",
  });
  const p = json?.data?.[0];
  return p ? toSummary(p) : null;
}
