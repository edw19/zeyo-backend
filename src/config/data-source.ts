import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { ProcessStep } from '../domain/entities/ProcessStep.js';
import { ProcessEvent } from '../domain/entities/ProcessEvent.js';

config();

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [ProcessStep, ProcessEvent],
    synchronize: false,
    logging: false,
    migrations: ['dist/migrations/*.js'],
});
