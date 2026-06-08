import { Router, type IRouter } from "express";
// 2026-05-21 — Rep training onboarding gate removed (Sprint 2 streamline).
import leads from "./leads";
import notifications from "./notifications";
import customDev from "./customDev";
import sales from "./sales";
import contactRequests from "./contactRequests";
import links from "./links";
import approvals from "./approvals";
import messages from "./messages";
import portals from "./portals";
import portalRequests from "./portalRequests";
import voice from "./voice";
import integrations from "./integrations";

const router: IRouter = Router();

router.use(leads);
router.use(notifications);
router.use(customDev);
router.use(sales);
router.use(contactRequests);
router.use(links);
router.use(approvals);
router.use(messages);
router.use(portals);
router.use(portalRequests);
router.use(voice);
router.use(integrations);

export default router;
