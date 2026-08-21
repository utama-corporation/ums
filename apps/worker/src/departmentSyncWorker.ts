import { prisma } from "@ums/db";
import { env } from "@ums/config";
import { createPollingLoop, PollingLoop } from "./pollingLoop.js";

// The org-structure API (`emp.padmoasm.com`) exposes one endpoint per company under the
// same base as the employee-directory endpoints used by employeeSyncWorker.ts, but with a
// different path shape: /api/v1/q/{companyPath} instead of /api/v1/q/employee-{companyPath}.
// Each row is a flattened Department -> Division -> SubDivision path; a company can repeat
// the same DepartmentName across many rows (once per Division under it).
const DEPARTMENT_ENDPOINTS: { endpoint: string; companyCode: string }[] = [
  { endpoint: "uc", companyCode: "UC" },
  { endpoint: "gsu", companyCode: "GSU" },
  { endpoint: "ru", companyCode: "RU" },
];

interface ExternalOrgRow {
  DepartmentName: string;
  DivisionName: string;
  SubDivisionName: string;
}

async function fetchOrgStructure(endpoint: string): Promise<ExternalOrgRow[]> {
  const res = await fetch(`${env.EMPLOYEE_API_BASE_URL}/${endpoint}`, {
    headers: { Authorization: `Bearer ${env.EMPLOYEE_API_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Org structure API request to ${endpoint} failed with status ${res.status}`);
  }
  const body = (await res.json()) as { success: boolean; data: ExternalOrgRow[] };
  if (!body.success) {
    throw new Error(`Org structure API request to ${endpoint} returned success=false`);
  }
  return body.data;
}

// Department.code is globally unique across companies, so every level of the hierarchy is
// namespaced by company code to avoid collisions between e.g. "Management" at UC and at RU.
export function slugifyOrgSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function buildDepartmentCode(companyCode: string, ...segments: string[]): string {
  const parts = [companyCode.toLowerCase(), ...segments.map(slugifyOrgSegment).filter(Boolean)];
  return parts.join("-").slice(0, 100);
}

async function upsertDepartment(code: string, name: string, parentId: string | null): Promise<string> {
  const dept = await prisma.department.upsert({
    where: { code },
    update: { name, parentId },
    create: { code, name, parentId },
  });
  return dept.id;
}

export async function runDepartmentSyncCycle(): Promise<{ companies: number; departments: number; divisions: number; subDivisions: number }> {
  if (!env.EMPLOYEE_API_TOKEN) {
    console.warn("[DEPARTMENT_SYNC] EMPLOYEE_API_TOKEN not configured, skipping scheduled sync");
    return { companies: 0, departments: 0, divisions: 0, subDivisions: 0 };
  }

  let departments = 0;
  let divisions = 0;
  let subDivisions = 0;

  for (const { endpoint, companyCode } of DEPARTMENT_ENDPOINTS) {
    await prisma.company.upsert({
      where: { code: companyCode },
      update: {},
      create: { code: companyCode, name: companyCode },
    });

    const rows = await fetchOrgStructure(endpoint);
    // Department name -> new Department id, scoped to this company only.
    const deptIdByName = new Map<string, string>();
    // "DepartmentName::DivisionName" -> new Department id, scoped to this company only.
    const divisionIdByKey = new Map<string, string>();

    for (const row of rows) {
      const deptName = row.DepartmentName?.trim();
      if (!deptName) continue;

      let deptId = deptIdByName.get(deptName);
      if (!deptId) {
        deptId = await upsertDepartment(buildDepartmentCode(companyCode, deptName), `${deptName} (${companyCode})`, null);
        deptIdByName.set(deptName, deptId);
        departments++;
      }

      const divName = row.DivisionName?.trim();
      if (!divName) continue;

      const divKey = `${deptName}::${divName}`;
      let divId = divisionIdByKey.get(divKey);
      if (!divId) {
        divId = await upsertDepartment(buildDepartmentCode(companyCode, deptName, divName), divName, deptId);
        divisionIdByKey.set(divKey, divId);
        divisions++;
      }

      const subDivName = row.SubDivisionName?.trim();
      if (!subDivName) continue;

      await upsertDepartment(buildDepartmentCode(companyCode, deptName, divName, subDivName), subDivName, divId);
      subDivisions++;
    }
  }

  console.log(
    `[DEPARTMENT_SYNC] Cycle complete: ${DEPARTMENT_ENDPOINTS.length} companies, ${departments} departments, ${divisions} divisions, ${subDivisions} sub-divisions upserted`
  );

  return { companies: DEPARTMENT_ENDPOINTS.length, departments, divisions, subDivisions };
}

export function createDepartmentSyncLoop(intervalMs = 6 * 60 * 60 * 1000): PollingLoop {
  return createPollingLoop("DEPARTMENT_SYNC", intervalMs, runDepartmentSyncCycle);
}
