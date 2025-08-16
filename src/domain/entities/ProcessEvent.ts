import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index,
    JoinColumn
} from 'typeorm';
import { ProcessStep } from './ProcessStep.js';

export type ProcessAction = 'CREATE' | 'UPDATE';

@Entity({ name: 'process_events' })
export class ProcessEvent {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'step_id' })
    stepId!: number;

    @Index()
    @ManyToOne(() => ProcessStep, (s) => s.events, { onDelete: 'CASCADE', eager: false })
    @JoinColumn({ name: 'step_id' })
    step!: ProcessStep;

    @Column({ type: 'varchar', length: 20 })
    action!: ProcessAction;

    @Index()
    @Column({ type: 'varchar', length: 64 })
    hash!: string;

    @Column({ name: 'previous_hash', type: 'varchar', length: 64, nullable: true })
    previousHash!: string | null;

    @Column({ type: 'jsonb' })
    payload!: Record<string, unknown>;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}
