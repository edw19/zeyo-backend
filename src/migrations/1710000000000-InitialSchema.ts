import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1710000000000 implements MigrationInterface {
    name = 'InitialSchema1710000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE process_steps (
        id SERIAL PRIMARY KEY,
        name VARCHAR(180) NOT NULL,
        description VARCHAR(400),
        step_order INT DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

        await queryRunner.query(`
      CREATE UNIQUE INDEX uq_step_name ON process_steps (name);
      CREATE INDEX idx_step_name ON process_steps (name);
      CREATE INDEX idx_step_order ON process_steps (step_order);
    `);

        await queryRunner.query(`
      CREATE TABLE process_events (
        id SERIAL PRIMARY KEY,
        step_id INT NOT NULL REFERENCES process_steps(id) ON DELETE CASCADE,
        action VARCHAR(20) NOT NULL,
        hash VARCHAR(64) NOT NULL,
        previous_hash VARCHAR(64),
        payload JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

        await queryRunner.query(`
      CREATE INDEX idx_event_step ON process_events (step_id);
      CREATE INDEX idx_event_hash ON process_events (hash);
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS process_events;`);
        await queryRunner.query(`DROP INDEX IF EXISTS uq_step_name;`);
        await queryRunner.query(`DROP TABLE IF EXISTS process_steps;`);
    }
}
