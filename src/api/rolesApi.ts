import { MicrosoftDataverseService as Dv } from "../generated/services/MicrosoftDataverseService";
import { getDataverseOrgUrl } from "./dataverse";

/**
 * Anyone holding at least one of these Dataverse security roles may use the
 * whole app (every screen, every action). Matched by role name — a role is
 * copied per business unit under the same name.
 */
export const ALLOWED_ROLES = [
  "Pharmacy - Admin",
  "Pharmacy - Dashboard Read All",
  "Pharmacy - Pharmacist",
  "System Customizer",
  "System Administrator",
];

const xmlEsc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const roleNameFilter = `<filter><condition attribute="name" operator="in">${ALLOWED_ROLES.map(
  (r) => `<value>${xmlEsc(r)}</value>`,
).join("")}</condition></filter>`;

/** Roles in ALLOWED_ROLES that the user holds directly. */
const directRolesFetch = (userId: string) =>
  `<fetch distinct="true"><entity name="role"><attribute name="name"/>${roleNameFilter}` +
  `<link-entity name="systemuserroles" from="roleid" to="roleid" intersect="true">` +
  `<filter><condition attribute="systemuserid" operator="eq" value="${xmlEsc(userId)}"/></filter>` +
  `</link-entity></entity></fetch>`;

/** Roles in ALLOWED_ROLES that the user gets through a team they belong to. */
const teamRolesFetch = (userId: string) =>
  `<fetch distinct="true"><entity name="role"><attribute name="name"/>${roleNameFilter}` +
  `<link-entity name="teamroles" from="roleid" to="roleid" intersect="true">` +
  `<link-entity name="team" from="teamid" to="teamid">` +
  `<link-entity name="teammembership" from="teamid" to="teamid" intersect="true">` +
  `<filter><condition attribute="systemuserid" operator="eq" value="${xmlEsc(userId)}"/></filter>` +
  `</link-entity></link-entity></link-entity></entity></fetch>`;

async function matchingRoles(fetchXml: string): Promise<string[]> {
  const res = await Dv.ListRecordsWithOrganization(
    getDataverseOrgUrl(),
    "roles",
    undefined,
    "application/json",
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    fetchXml,
  );
  if (!res.success) {
    const err = res.error as { message?: string } | string | undefined;
    throw new Error(String((typeof err === "object" ? err?.message : err) ?? "roles query failed"));
  }
  const body = res.data as { value?: { name?: string }[] };
  return (body.value ?? []).map((r) => String(r.name ?? ""));
}

/**
 * The names of the ALLOWED_ROLES the user holds — directly or through a team.
 * An empty list means no access.
 */
export async function getAllowedRolesOf(systemUserId: string): Promise<string[]> {
  const [direct, viaTeam] = await Promise.all([
    matchingRoles(directRolesFetch(systemUserId)),
    matchingRoles(teamRolesFetch(systemUserId)),
  ]);
  return [...new Set([...direct, ...viaTeam])];
}
