import 'reflect-metadata';
import { config } from 'dotenv';
import { AppDataSource } from './config/data-source.js';
import { buildApp } from './app.js';

config();

const port = Number(process.env.PORT || 3000);

async function main() {
    await AppDataSource.initialize();
    const app = buildApp();
    app.listen(port, () => console.log(`API running on http://localhost:${port}`));
}

main().catch((e) => {
    console.error('Failed to start', e);
    process.exit(1);
});
