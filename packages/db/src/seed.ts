import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database foundation data...");

  // 1. Company Profile
  await prisma.companyProfile.upsert({
    where: { code: "UTAMA" },
    update: {},
    create: {
      name: "PT Utama Corp",
      code: "UTAMA",
      email: "info@utama.co.id",
    },
  });

  // 2. Permissions
  const permissions = [
    "memo.create", "memo.view", "memo.update", "memo.delete", "memo.submit",
    "memo.approve", "memo.reject", "memo.publish", "memo.archive", "memo.print", "memo.export",
    "task.create", "task.update", "task.complete",
    "report.view", "report.export",
    "master.user.manage", "master.department.manage", "master.category.manage",
    "master.workflow.manage", "master.signature.manage", "master.company.manage",
    "settings.manage", "audit.view"
  ];

  const permRecords = [];
  for (const permCode of permissions) {
    const [moduleName] = permCode.split(".");
    const p = await prisma.permission.upsert({
      where: { code: permCode },
      update: {},
      create: {
        code: permCode,
        module: moduleName || "system",
        description: `Permission to ${permCode}`,
      },
    });
    permRecords.push(p);
  }

  // 3. Roles & Permissions mapping
  // Permission sets per role, derived from role responsibilities in the product context.
  const rolePermissionMap: Record<string, string[] | "ALL"> = {
    SUPER_ADMIN: "ALL",
    MEMO_ADMIN: [
      "memo.create", "memo.view", "memo.update", "memo.delete", "memo.submit",
      "memo.publish", "memo.archive", "memo.print", "memo.export",
      "report.view", "report.export",
      "master.category.manage", "master.workflow.manage", "master.signature.manage", "master.company.manage",
      "audit.view",
    ],
    MANAGEMENT: [
      "memo.create", "memo.view", "memo.submit", "memo.approve", "memo.reject",
      "memo.publish", "memo.print", "memo.export",
      "report.view", "report.export",
    ],
    DEPARTMENT_HEAD: [
      "memo.create", "memo.view", "memo.update", "memo.submit",
      "memo.approve", "memo.reject", "memo.print",
      "task.create", "task.update",
      "report.view",
      "master.department.manage",
    ],
    STAFF: [
      "memo.create", "memo.view", "memo.update", "memo.submit", "memo.print",
      "task.create", "task.update", "task.complete",
    ],
    APPROVER: [
      "memo.view", "memo.approve", "memo.reject",
      "task.update", "task.complete",
    ],
    AUDITOR: [
      "memo.view",
      "report.view", "report.export",
      "audit.view",
    ],
  };

  const roleMap: Record<string, string> = {};
  for (const [roleName, allowedCodes] of Object.entries(rolePermissionMap)) {
    const r = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `Role ${roleName}`,
        isSystem: true,
      },
    });
    roleMap[roleName] = r.id;

    const grantedPermissions = allowedCodes === "ALL"
      ? permRecords
      : permRecords.filter((p) => allowedCodes.includes(p.code));

    for (const p of grantedPermissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: r.id, permissionId: p.id } },
        update: {},
        create: { roleId: r.id, permissionId: p.id },
      });
    }

    console.log(`Seeded role: ${roleName} [${grantedPermissions.length} permissions]`);
  }

  // 4. Departments
  const deptIT = await prisma.department.upsert({
    where: { code: "IT" },
    update: {},
    create: { code: "IT", name: "Teknologi Informasi" },
  });

  const deptHR = await prisma.department.upsert({
    where: { code: "HR" },
    update: {},
    create: { code: "HR", name: "Sumber Daya Manusia" },
  });

  const deptFIN = await prisma.department.upsert({
    where: { code: "FIN" },
    update: {},
    create: { code: "FIN", name: "Keuangan & Akuntansi" },
  });

  // 5. Seed Development Accounts
  const defaultPasswordHash = await bcrypt.hash("Password123!", 10);

  const devUsers = [
    { username: "admin", email: "admin@utama.co.id", name: "Super Administrator", role: "SUPER_ADMIN", deptId: deptIT.id },
    { username: "memo.admin", email: "memo.admin@utama.co.id", name: "Memo Administrator", role: "MEMO_ADMIN", deptId: deptIT.id },
    { username: "depthead", email: "depthead@utama.co.id", name: "Head of HR", role: "DEPARTMENT_HEAD", deptId: deptHR.id },
    { username: "staff", email: "staff@utama.co.id", name: "Staff HR", role: "STAFF", deptId: deptHR.id },
    { username: "approver", email: "approver@utama.co.id", name: "Finance Approver", role: "APPROVER", deptId: deptFIN.id },
    { username: "auditor", email: "auditor@utama.co.id", name: "Internal Auditor", role: "AUDITOR", deptId: deptFIN.id },
  ];

  for (const u of devUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { username: u.username },
      create: {
        username: u.username,
        email: u.email,
        fullName: u.name,
        departmentId: u.deptId,
        isActive: true,
        credentials: {
          create: { passwordHash: defaultPasswordHash },
        },
      },
    });

    const roleId = roleMap[u.role];
    if (roleId) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        update: {},
        create: { userId: user.id, roleId },
      });
    }

    console.log(`Seeded user: ${u.username} (${u.email}) [${u.role}]`);
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
