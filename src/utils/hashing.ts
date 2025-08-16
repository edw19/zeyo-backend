import { createHash } from 'crypto';

export function sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

/**
 * Crea el “bloque” a firmar:
 * - previousHash: último hash del step (o null en CREATE)
 * - action: CREATE | UPDATE
 * - stepId: id del step
 * - payload: json con snapshot (name, description, order, timestamp)
 * - timestamp: ISO
 */
export function buildBlockToHash(params: {
    previousHash: string | null;
    action: 'CREATE' | 'UPDATE';
    stepId: number;
    payload: Record<string, unknown>;
    timestamp: string;
}): string {
    const { previousHash, action, stepId, payload, timestamp } = params;
    return [
        previousHash ?? 'GENESIS',
        action,
        stepId,
        JSON.stringify(payload),
        timestamp
    ].join('|');
}
