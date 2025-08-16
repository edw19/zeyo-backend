import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index, Unique
} from 'typeorm';
import { ProcessEvent } from './ProcessEvent.js';

@Entity({ name: 'process_steps' })
@Unique('uq_step_name', ['name'])
export class ProcessStep {
    @PrimaryGeneratedColumn()
    id!: number;

    @Index()
    @Column({ type: 'varchar', length: 180 })
    name!: string;

    @Column({ type: 'varchar', length: 400, nullable: true })
    description!: string | null;

    @Index()
    @Column({ type: 'int', default: 0, name: 'step_order' })
    stepOrder!: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;

    @OneToMany(() => ProcessEvent, (e) => e.step)
    events!: ProcessEvent[];
}
