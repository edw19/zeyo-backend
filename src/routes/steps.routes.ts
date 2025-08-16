import { Router } from 'express';
import { StepsService } from '../services/steps.service.js';
import { validate } from '../middlewares/zod.middleware.js';
import { CreateStepDto, UpdateStepDto } from '../domain/dtos/step.dto.js';

const router = Router();
const service = new StepsService();

// GET /steps
router.get('/', async (req, res, next) => {
    try {
        const data = await service.listSteps();
        res.json({ data });
    } catch (e) { next(e); }
});

// POST /steps
router.post('/', validate(CreateStepDto), async (req, res, next) => {
    try {
        const step = await service.createStep(req.body);
        res.status(201).json({ data: step });
    } catch (e: any) {
        // nombre duplicado, etc.
        if (e?.code === '23505') return res.status(409).json({ error: true, message: 'Step name already exists' });
        next(e);
    }
});

// GET /steps/:id
router.get('/:id', async (req, res, next) => {
    try {
        const step = await service.getStep(Number(req.params.id));
        res.json({ data: step });
    } catch (e) {
        if ((e as Error).message === 'NOT_FOUND') return res.status(404).json({ error: true, message: 'Not found' });
        next(e);
    }
});

// PUT /steps/:id
router.put('/:id', validate(UpdateStepDto), async (req, res, next) => {
    try {
        const step = await service.updateStep(Number(req.params.id), req.body);
        res.json({ data: step });
    } catch (e) {
        if ((e as Error).message === 'NOT_FOUND') return res.status(404).json({ error: true, message: 'Not found' });
        next(e);
    }
});

// GET /steps/:id/history
router.get('/:id/history', async (req, res, next) => {
    try {
        const history = await service.getStepEvents(Number(req.params.id));
        res.json({ data: history });
    } catch (e) {
        if ((e as Error).message === 'NOT_FOUND') return res.status(404).json({ error: true, message: 'Not found' });
        next(e);
    }
});

// GET /steps/:id/verify
router.get('/:id/verify', async (req, res, next) => {
    try {
        const result = await service.verifyChain(Number(req.params.id));
        res.json(result);
    } catch (e) { next(e); }
});

export default router;
