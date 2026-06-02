import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import sitesRouter from "./sites.js";
import notificationsRouter from "./notifications.js";
import paymentsRouter from "./payments.js";
import expensesRouter from "./expenses.js";
import messagesRouter from "./messages.js";
import packagesRouter from "./packages.js";
import chatsRouter from "./chats.js";
import vendorsRouter from "./vendors.js";
import adminTransfersRouter from "./admin-transfers.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(sitesRouter);
router.use(notificationsRouter);
router.use(paymentsRouter);
router.use(expensesRouter);
router.use(messagesRouter);
router.use(packagesRouter);
router.use(chatsRouter);
router.use(vendorsRouter);
router.use(adminTransfersRouter);

export default router;
