import { AppDataSource } from '../config/data-source.js';
import { ProcessStep } from '../domain/entities/ProcessStep.js';
import { ProcessEvent } from '../domain/entities/ProcessEvent.js';
import { buildBlockToHash, sha256 } from '../utils/hashing.js';
import { In } from 'typeorm';

export class StepsService {
    private stepRepo = AppDataSource.getRepository(ProcessStep);
    private eventRepo = AppDataSource.getRepository(ProcessEvent);

    async listSteps() {
        return this.stepRepo.find({ order: { stepOrder: 'ASC', id: 'ASC' } });
    }

    async getStep(id: number) {
        const step = await this.stepRepo.findOne({ where: { id } });
        if (!step) throw new Error('NOT_FOUND');
        return step;
    }

    async getStepEvents(id: number) {
        const step = await this.getStep(id);
        return this.eventRepo.find({
            where: { step: { id: step.id } },
            order: { id: 'ASC' }
        });
    }

    private async getLastHashForStep(stepId: number): Promise<string | null> {
        const last = await this.eventRepo.find({
            where: { step: { id: stepId } },
            order: { id: 'DESC' },
            take: 1
        });
        return last[0]?.hash ?? null;
    }

    async createStep(input: { name: string; description?: string | null; stepOrder: number }) {
        const step = this.stepRepo.create({
            name: input.name,
            description: input.description ?? null,
            stepOrder: input.stepOrder ?? 0
        });
        await this.stepRepo.save(step);

        const timestamp = new Date().toISOString();
        const payload = {
            name: step.name,
            description: step.description,
            stepOrder: step.stepOrder,
            timestamp
        };
        const block = buildBlockToHash({
            previousHash: null,
            action: 'CREATE',
            stepId: step.id,
            payload,
            timestamp
        });
        const hash = sha256(block);

        const event = this.eventRepo.create({
            step,
            action: 'CREATE',
            hash,
            previousHash: null,
            payload
        });
        await this.eventRepo.save(event);

        return step;
    }

    async updateStep(id: number, input: Partial<{ name: string; description: string | null; stepOrder: number }>) {
        const step = await this.getStep(id);

        if (typeof input.name === 'string') step.name = input.name;
        if (typeof input.stepOrder === 'number') step.stepOrder = input.stepOrder;
        if (input.description !== undefined) step.description = input.description;
        await this.stepRepo.save(step);

        const previousHash = await this.getLastHashForStep(step.id);
        const timestamp = new Date().toISOString();
        const payload = {
            name: step.name,
            description: step.description,
            stepOrder: step.stepOrder,
            timestamp
        };
        const block = buildBlockToHash({
            previousHash,
            action: 'UPDATE',
            stepId: step.id,
            payload,
            timestamp
        });
        const hash = sha256(block);

        const event = this.eventRepo.create({
            step,
            action: 'UPDATE',
            hash,
            previousHash,
            payload
        });
        await this.eventRepo.save(event);

        return step;
    }

    async verifyChain(stepId: number) {
        const events = await this.getStepEvents(stepId);
        let prev: string | null = null;
        for (const e of events) {
            const recomputed = sha256(
                [
                    prev ?? 'GENESIS',
                    e.action,
                    stepId,
                    JSON.stringify(e.payload),
                    e.payload?.['timestamp'] as string
                ].join('|')
            );
            if (e.previousHash !== prev || e.hash !== recomputed) {
                return { ok: false, atEventId: e.id };
            }
            prev = e.hash;
        }
        return { ok: true, count: events.length };
    }

    async reorder(idsInOrder: number[]) {
        const steps = await this.stepRepo.find({ where: { id: In(idsInOrder) } });
        const map = new Map(steps.map(s => [s.id, s]));
        idsInOrder.forEach((id, idx) => {
            const s = map.get(id);
            if (s) s.stepOrder = idx;
        });
        await this.stepRepo.save([...map.values()]);
    }
}
