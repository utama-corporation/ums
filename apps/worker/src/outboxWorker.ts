import { prisma } from "@ums/db";
import { sendEmailNotification } from "./mailer.js";
import { processExportRequested, ExportRequestedPayload } from "./exportWorker.js";
import { renderEmailTemplate } from "./emailTemplates.js";
import { createPollingLoop, PollingLoop } from "./pollingLoop.js";

async function notifyUsers(
  userIds: string[],
  params: { title: string; message: string; type: string; link?: string; vars?: Record<string, string> }
) {
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length === 0) return;

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, email: true },
  });

  // The in-app notification always uses title/message as-is (reliable, never edited by admins).
  // The email is separately rendered from the admin-editable template for this notification
  // type, falling back to the same content if no custom template exists yet.
  const vars = { title: params.title, message: params.message, ...(params.vars || {}) };
  const rendered = await renderEmailTemplate(params.type, vars);
  const emailSubject = rendered?.subject || params.title;
  const emailBody = rendered?.bodyHtml || `<h2>${params.title}</h2><p>${params.message}</p>`;

  for (const user of users) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: params.title,
        message: params.message,
        type: params.type,
        link: params.link || null,
      },
    });
    if (user.email) {
      // Email delivery failure must not stop the in-app notification (already created above)
      // from reaching other recipients, and must not fail the whole outbox event.
      try {
        await sendEmailNotification(user.email, `[UMS] ${emailSubject}`, emailBody);
      } catch (err) {
        console.error(`[OUTBOX_WORKER] Email delivery failed for ${user.email}, in-app notification still recorded:`, err);
      }
    }
  }
}

export async function processOutboxEvent(event: {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payloadJson: string;
}) {
  switch (event.eventType) {
    case "MEMO_SUBMITTED": {
      console.log(`[OUTBOX_WORKER] Processing MEMO_SUBMITTED for Memo ID ${event.aggregateId}`);
      const memo = await prisma.memo.findUnique({
        where: { id: event.aggregateId },
        include: {
          workflowInstances: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              steps: {
                where: { status: "ACTIVE" },
                include: { assignments: { where: { status: "PENDING" } } },
              },
            },
          },
        },
      });

      if (memo) {
        const activeStep = memo.workflowInstances[0]?.steps[0];
        const approverIds = Array.from(new Set(activeStep?.assignments.map((a) => a.approverId) ?? []));

        if (approverIds.length === 0) {
          console.warn(`[OUTBOX_WORKER] MEMO_SUBMITTED for Memo ID ${event.aggregateId}: no active approver assignment found, skipping notification`);
          break;
        }

        await notifyUsers(approverIds, {
          title: `Memo Submitted for Approval: ${memo.title}`,
          message: `Memo "${memo.title}" telah diajukan dan membutuhkan tindakan persetujuan Anda.`,
          type: "APPROVAL_REQUIRED",
          link: `/approvals/${event.aggregateId}`,
          vars: { memoTitle: memo.title },
        });
      }
      break;
    }

    case "MEMO_APPROVED": {
      console.log(`[OUTBOX_WORKER] Processing MEMO_APPROVED for Memo ID ${event.aggregateId}`);
      const memo = await prisma.memo.findUnique({
        where: { id: event.aggregateId },
      });

      if (memo) {
        await notifyUsers([memo.authorId], {
          title: `Memo Disetujui: ${memo.memoNumber || memo.title}`,
          message: `Memo dengan nomor resmi ${memo.memoNumber || "-"} telah disetujui penuh oleh para approver.`,
          type: "MEMO_APPROVED",
          link: `/memos/${memo.id}`,
          vars: { memoNumber: memo.memoNumber || "-", memoTitle: memo.title },
        });
      }
      break;
    }

    case "EXPORT_REQUESTED": {
      console.log(`[OUTBOX_WORKER] Processing EXPORT_REQUESTED for ExportJob ID ${event.aggregateId}`);
      const payload = JSON.parse(event.payloadJson) as ExportRequestedPayload;
      await processExportRequested(payload);
      break;
    }

    case "MEMO_DISTRIBUTED": {
      console.log(`[OUTBOX_WORKER] Processing MEMO_DISTRIBUTED for Memo ID ${event.aggregateId}`);
      break;
    }

    case "MEMO_PUBLISHED": {
      console.log(`[OUTBOX_WORKER] Processing MEMO_PUBLISHED for Memo ID ${event.aggregateId}`);
      break;
    }

    case "TASK_ASSIGNED": {
      console.log(`[OUTBOX_WORKER] Processing TASK_ASSIGNED for Task ID ${event.aggregateId}`);
      const payload = JSON.parse(event.payloadJson) as {
        taskId: string;
        title: string;
        memoTitle: string;
        memoNumber: string | null;
        assigneeUserIds: string[];
      };
      await notifyUsers(payload.assigneeUserIds, {
        title: `Tugas Baru: ${payload.title}`,
        message: `Anda mendapat tugas baru "${payload.title}" dari disposisi memo ${payload.memoNumber || payload.memoTitle}.`,
        type: "TASK_ASSIGNED",
        link: `/tasks/assigned`,
        vars: { taskTitle: payload.title, memoNumber: payload.memoNumber || "-", memoTitle: payload.memoTitle },
      });
      break;
    }

    case "TASK_VERIFICATION_REQUESTED": {
      console.log(`[OUTBOX_WORKER] Processing TASK_VERIFICATION_REQUESTED for Task ID ${event.aggregateId}`);
      const payload = JSON.parse(event.payloadJson) as { taskId: string; title: string; issuerId: string };
      await notifyUsers([payload.issuerId], {
        title: `Menunggu Verifikasi: ${payload.title}`,
        message: `Tugas "${payload.title}" telah dilaporkan selesai dan menunggu verifikasi Anda.`,
        type: "TASK_VERIFICATION_REQUESTED",
        link: `/tasks/issued`,
        vars: { taskTitle: payload.title },
      });
      break;
    }

    case "TASK_VERIFIED_COMPLETED": {
      console.log(`[OUTBOX_WORKER] Processing TASK_VERIFIED_COMPLETED for Task ID ${event.aggregateId}`);
      const payload = JSON.parse(event.payloadJson) as { taskId: string; title: string; assigneeUserIds: string[] };
      await notifyUsers(payload.assigneeUserIds, {
        title: `Tugas Disetujui: ${payload.title}`,
        message: `Tugas "${payload.title}" telah diverifikasi dan disetujui selesai oleh pemberi tugas.`,
        type: "TASK_VERIFIED_COMPLETED",
        link: `/tasks/assigned`,
        vars: { taskTitle: payload.title },
      });
      break;
    }

    case "TASK_REWORK_REQUESTED": {
      console.log(`[OUTBOX_WORKER] Processing TASK_REWORK_REQUESTED for Task ID ${event.aggregateId}`);
      const payload = JSON.parse(event.payloadJson) as { taskId: string; title: string; assigneeUserIds: string[]; comment: string | null };
      await notifyUsers(payload.assigneeUserIds, {
        title: `Tugas Perlu Direvisi: ${payload.title}`,
        message: `Tugas "${payload.title}" dikembalikan untuk dikerjakan ulang.${payload.comment ? ` Catatan: ${payload.comment}` : ""}`,
        type: "TASK_REWORK_REQUESTED",
        link: `/tasks/assigned`,
        vars: { taskTitle: payload.title, comment: payload.comment || "-" },
      });
      break;
    }

    case "TASK_OVERDUE": {
      console.log(`[OUTBOX_WORKER] Processing TASK_OVERDUE for Task ID ${event.aggregateId}`);
      const payload = JSON.parse(event.payloadJson) as { taskId: string; title: string; issuerId: string; assigneeUserIds: string[] };
      await notifyUsers([...payload.assigneeUserIds, payload.issuerId], {
        title: `Tugas Terlambat: ${payload.title}`,
        message: `Tugas "${payload.title}" telah melewati batas waktu (deadline) dan ditandai terlambat.`,
        type: "TASK_OVERDUE",
        link: `/tasks/assigned`,
        vars: { taskTitle: payload.title },
      });
      break;
    }

    case "SMTP_TEST_EMAIL_REQUESTED": {
      console.log(`[OUTBOX_WORKER] Processing SMTP_TEST_EMAIL_REQUESTED`);
      const payload = JSON.parse(event.payloadJson) as { to: string };
      await sendEmailNotification(
        payload.to,
        "Email Test - Utama Memo System",
        "<h2>Email Test Berhasil</h2><p>Jika Anda menerima email ini, konfigurasi SMTP di Settings sudah berfungsi dengan benar.</p>"
      );
      break;
    }

    default:
      console.log(`[OUTBOX_WORKER] Unknown event type: ${event.eventType}`);
  }
}

export async function runOutboxWorkerCycle(): Promise<number> {
  const events = await prisma.domainOutboxEvent.findMany({
    where: { status: "PENDING" },
    take: 10,
    orderBy: { createdAt: "asc" },
  });

  for (const event of events) {
    try {
      await processOutboxEvent(event);
      await prisma.domainOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`[OUTBOX_WORKER_ERROR] Event ${event.id} failed:`, error);
      await prisma.domainOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          errorLog: error instanceof Error ? error.stack : String(error),
        },
      });
    }
  }

  return events.length;
}

export function createOutboxWorkerLoop(pollIntervalMs = 5000): PollingLoop {
  return createPollingLoop("OUTBOX_WORKER", pollIntervalMs, runOutboxWorkerCycle);
}
