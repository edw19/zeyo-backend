import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';

export const buildApp = () => {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.use('/api', routes);
    app.use(errorHandler);

    return app;
};
