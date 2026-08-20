import { prisma } from "@ums/db";
import { env } from "@ums/config";
import { logAuditEvent } from "./auditService.js";

interface ExternalEmployeeRaw {
  EmployeeID: number;
  FullName: string;
  EmployeeCode: string;
  Email: string;
  MobilePhone: string;
  Company: string;
}

export interface ExternalEmployee {
  externalId: number;
  fullName: string;
  nik: string;
  email: string | null;
  mobilePhone: string | null;
  companyCode: string;
}

// Roles whose holders are exempt from the employee-directory auto-disable sweep —
// they run the system rather than being a rank-and-file employee record in HR.
const AUTO_DISABLE_EXEMPT_ROLES = ["SUPER_ADMIN", "MANAGEMENT"];

const EMPLOYEE_ENDPOINTS = ["employee-uc", "employee-ru", "employee"];

let employeeCache: { data: ExternalEmployee[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "-" ? trimmed : null;
}

async function fetchEndpoint(endpoint: string): Promise<ExternalEmployeeRaw[]> {
  const res = await fetch(`${env.EMPLOYEE_API_BASE_URL}/${endpoint}`, {
    headers: { Authorization: `Bearer ${env.EMPLOYEE_API_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Employee API request to ${endpoint} failed with status ${res.status}`);
  }
  const body = (await res.json()) as { success: boolean; data: ExternalEmployeeRaw[] };
  if (!body.success) {
    throw new Error(`Employee API request to ${endpoint} returned success=false`);
  }
  return body.data;
}

export async function fetchAllExternalEmployees(): Promise<ExternalEmployee[]> {
  const results = await Promise.all(EMPLOYEE_ENDPOINTS.map(fetchEndpoint));
  const seenNiks = new Set<string>();
  const employees: ExternalEmployee[] = [];

  for (const raw of results.flat()) {
    const nik = raw.EmployeeCode?.trim();
    if (!nik || seenNiks.has(nik)) continue;
    seenNiks.add(nik);
    employees.push({
      externalId: raw.EmployeeID,
      fullName: raw.FullName.trim(),
      nik,
      email: cleanText(raw.Email),
      mobilePhone: cleanText(raw.MobilePhone),
      companyCode: raw.Company.trim().toUpperCase(),
    });
  }

  return employees;
}

async function getCachedEmployees(): Promise<ExternalEmployee[]> {
  if (employeeCache && Date.now() - employeeCache.fetchedAt < CACHE_TTL_MS) {
    return employeeCache.data;
  }
  const data = await fetchAllExternalEmployees();
  employeeCache = { data, fetchedAt: Date.now() };
  return data;
}

export interface EmployeeSearchResult extends ExternalEmployee {
  hasAccount: boolean;
}

export async function searchEmployees(query: string, limit = 20): Promise<EmployeeSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const employees = await getCachedEmployees();
  const matches = employees
    .filter((e) => e.fullName.toLowerCase().includes(q) || e.nik.toLowerCase().includes(q))
    .slice(0, limit);

  if (matches.length === 0) return [];

  const existingUsers = await prisma.user.findMany({
    where: { employeeId: { in: matches.map((m) => m.nik) } },
    select: { employeeId: true },
  });
  const nikWithAccount = new Set(existingUsers.map((u) => u.employeeId));

  return matches.map((m) => ({ ...m, hasAccount: nikWithAccount.has(m.nik) }));
}

export interface EmployeeSyncSummary {
  totalEmployeesFetched: number;
  companiesUpserted: number;
  usersChecked: number;
  usersDisabled: { id: string; username: string; fullName: string }[];
}

export async function syncEmployees(actorId?: string): Promise<EmployeeSyncSummary> {
  const employees = await fetchAllExternalEmployees();
  employeeCache = { data: employees, fetchedAt: Date.now() };

  const companyCodes = Array.from(new Set(employees.map((e) => e.companyCode)));
  for (const code of companyCodes) {
    await prisma.company.upsert({
      where: { code },
      update: {},
      create: { code, name: code },
    });
  }

  const activeNiks = new Set(employees.map((e) => e.nik));

  const candidateUsers = await prisma.user.findMany({
    where: { isActive: true, employeeId: { not: null } },
    include: { userRoles: { include: { role: true } } },
  });

  const usersToDisable = candidateUsers.filter((u) => {
    const isExempt = u.userRoles.some((ur) => AUTO_DISABLE_EXEMPT_ROLES.includes(ur.role.name));
    return !isExempt && u.employeeId && !activeNiks.has(u.employeeId);
  });

  for (const user of usersToDisable) {
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    await logAuditEvent({
      actorId,
      action: "USER_AUTO_DISABLED_EMPLOYEE_SYNC",
      module: "master.user",
      resourceType: "User",
      resourceId: user.id,
      beforeData: { isActive: true, employeeId: user.employeeId },
      afterData: { isActive: false, reason: "Not found in employee directory" },
    });
  }

  return {
    totalEmployeesFetched: employees.length,
    companiesUpserted: companyCodes.length,
    usersChecked: candidateUsers.length,
    usersDisabled: usersToDisable.map((u) => ({ id: u.id, username: u.username, fullName: u.fullName })),
  };
}
