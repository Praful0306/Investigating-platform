import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { z } from 'zod';
import { errorHandler } from '../../src/middleware/error.js';
import { AppError } from '../../src/utils/app-error.js';

const app = express();
app.get('/app-error', () => { throw new AppError('CASE_NOT_FOUND', 404, 'Case not found'); });
app.get('/zod', () => { z.object({ premise: z.string().min(10, 'too short') }).parse({ premise: 'x' }); });
app.get('/cast', () => { throw new mongoose.Error.CastError('ObjectId', 'zzz', '_id'); });
app.get('/boom-async', async () => { throw new Error('db password is hunter2'); });
app.use(errorHandler);

describe('errorHandler', () => {
  it('AppError -> its status/code/message', async () => {
    const res = await request(app).get('/app-error').expect(404);
    expect(res.body).toEqual({ error: { code: 'CASE_NOT_FOUND', message: 'Case not found' } });
  });

  it('ZodError -> 400 VALIDATION_ERROR with path/message details', async () => {
    const res = await request(app).get('/zod').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([{ path: 'premise', message: 'too short' }]);
  });

  it('CastError -> 400 INVALID_ID', async () => {
    const res = await request(app).get('/cast').expect(400);
    expect(res.body.error.code).toBe('INVALID_ID');
  });

  it('async throw is forwarded (Express 5) -> generic 500, no stack, no message leak', async () => {
    const res = await request(app).get('/boom-async').expect(500);
    expect(res.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
    expect(JSON.stringify(res.body)).not.toMatch(/hunter2|stack|at /);
  });
});
