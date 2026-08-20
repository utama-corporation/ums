import { prisma } from "@ums/db";
import { sendEmailNotification } from "./mailer.js";
import { processExportRequested, ExportRequestedPayload } from "./exportWorker.js";

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

        const approvers = await prisma.user.findMany({
          where: { id: { in: approverIds } },
          select: { id: true, email: true },
        });

        const title = `[UMS] Memo Submitted for Approval: ${memo.title}`;
        const message = `Memo "${memo.title}" telah diajukan dan membutuhkan tindakan persetujuan Anda.`;
        const html = `<h2>Pemberitahuan Persetujuan Memo</h2><p>Memo dengan judul <strong>${memo.title}</strong> telah diajukan dan membutuhkan tindakan persetujuan Anda.</p>`;

        for (const approver of approvers) {
          await prisma.notification.create({
            data: {
              userId: approver.id,
              title,
              message,
              type: "APPROVAL_REQUIRED",
              link: `/approvals/${event.aggregateId}`,
            },
          });
          if (approver.email) {
            await sendEmailNotification(approver.email, title, html);
          }
        }
      }
      break;
    }

    case "MEMO_APPROVED": {
      console.log(`[OUTBOX_WORKER] Processing MEMO_APPROVED for Memo ID ${event.aggregateId}`);
      const memo = await prisma.memo.findUnique({
        where: { id: event.aggregateId },
      });

      if (memo) {
        const author = await prisma.user.findUnique({ where: { id: memo.authorId } });
        if (author) {
          const title = `[UMS] Memo Disetujui: ${memo.memoNumber || memo.title}`;
          const message = `Memo dengan nomor resmi ${memo.memoNumber || "-"} telah disetujui penuh oleh para approver.`;
          const html = `<h2>Memo Anda Telah Disetujui</h2><p>Memo dengan nomor resmi <strong>${memo.memoNumber || "-"}</strong> telah disetujui penuh oleh para approver.</p>`;

          await prisma.notification.create({
            data: {
              userId: author.id,
              title,
              message,
              type: "MEMO_APPROVED",
              link: `/memos/${memo.id}`,
            },
          });

          if (author.email) {
            await sendEmailNotification(author.email, title, html);
          }
        }
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

export function startOutboxWorkerLoop(pollIntervalMs = 5000) {
  console.log(`[OUTBOX_WORKER] Starting outbox polling loop (interval: ${pollIntervalMs}ms)...`);
  setInterval(async () => {
    try {
      await runOutboxWorkerCycle();
    } catch (err) {
      console.error("[OUTBOX_WORKER_LOOP_ERROR]", err);
    }
  }, pollIntervalMs);
}
