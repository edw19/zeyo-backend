import { Router } from 'express';
import stepsRouter from './steps.routes.js';

const router = Router();

router.use('/steps', stepsRouter);

router.get('/health', (_req, res) => res.json({ ok: true }));

export default router;
