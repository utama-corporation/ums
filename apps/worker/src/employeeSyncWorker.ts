import { prisma } from "@ums/db";
import { env } from "@ums/config";

interface ExternalEmployeeRaw {
  EmployeeID: number;
  FullName: string;
  EmployeeCode: string;
  Email: string;
  MobilePhone: string;
  Company: string;
}

interface ExternalEmployee {
  nik: string;
  companyCode: string;
}

// Kept in sync with apps/api/src/services/employeeSyncService.ts's AUTO_DISABLE_EXEMPT_ROLES.
const AUTO_DISABLE_EXEMPT_ROLES = ["SUPER_ADMIN", "MANAGEMENT"];
const EMPLOYEE_ENDPOINTS = ["employee-uc", "employee-ru", "employee"];

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

async function fetchAllExternalEmployees(): Promise<ExternalEmployee[]> {
  const results = await Promise.all(EMPLOYEE_ENDPOINTS.map(fetchEndpoint));
  const seenNiks = new Set<string>();
  const employees: ExternalEmployee[] = [];

  for (const raw of results.flat()) {
    const nik = raw.EmployeeCode?.trim();
    if (!nik || seenNiks.has(nik)) continue;
    seenNiks.add(nik);
    employees.push({ nik, companyCode: raw.Company.trim().toUpperCase() });
  }

  return employees;
}

export async function runEmployeeSyncCycle(): Promise<void> {
  if (!env.EMPLOYEE_API_TOKEN) {
    console.warn("[EMPLOYEE_SYNC] EMPLOYEE_API_TOKEN not configured, skipping scheduled sync");
    return;
  }

  const employees = await fetchAllExternalEmployees();
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
    await prisma.auditEvent.create({
      data: {
        actorId: null,
        action: "USER_AUTO_DISABLED_EMPLOYEE_SYNC",
        module: "master.user",
        resourceType: "User",
        resourceId: user.id,
        beforeJson: JSON.stringify({ isActive: true, employeeId: user.employeeId }),
        afterJson: JSON.stringify({ isActive: false, reason: "Not found in employee directory (scheduled sync)" }),
      },
    });
  }

  console.log(
    `[EMPLOYEE_SYNC] Cycle complete: ${employees.length} employees fetched, ${companyCodes.length} companies upserted, ${usersToDisable.length} users disabled`
  );
}

export function startEmployeeSyncLoop(intervalMs = 6 * 60 * 60 * 1000) {
  console.log(`[EMPLOYEE_SYNC] Starting scheduled employee sync loop (interval: ${intervalMs}ms)...`);
  setInterval(async () => {
    try {
      await runEmployeeSyncCycle();
    } catch (err) {
      console.error("[EMPLOYEE_SYNC_LOOP_ERROR]", err);
    }
  }, intervalMs);
}
