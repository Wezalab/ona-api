import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Full-stack e2e against an in-memory MongoDB with the blockchain DISABLED, so
 * screenings persist and are marked `disabled` (no network calls). Exercises the
 * auth → clinic → patient → screening flow and role enforcement.
 */
describe('ONA API (e2e)', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  let http: ReturnType<typeof request>;
  let accessToken: string;
  let clinicId: string;
  let patientId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();

    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.SEED_ADMIN_EMAIL = 'admin@ona.org';
    process.env.SEED_ADMIN_PASSWORD = 'admin1234';
    process.env.STARKNET_RPC_URL = 'https://rpc.example';
    process.env.STARKNET_CONTRACT_ADDRESS = '0x123';
    process.env.STARKNET_OWNER_ADDRESS = '0xabc';
    process.env.STARKNET_OWNER_PRIVATE_KEY = '0xdef';
    process.env.BLOCKCHAIN_ENABLED = 'false';

    // Import AppModule after env is set so ConfigModule validation passes
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('rejects unauthenticated access to protected routes', async () => {
    await http.get('/api/clinics').expect(401);
  });

  it('logs in the seeded admin', async () => {
    const res = await http
      .post('/api/auth/login')
      .send({ email: 'admin@ona.org', password: 'admin1234' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    accessToken = res.body.data.accessToken;
  });

  it('rejects bad credentials', async () => {
    await http
      .post('/api/auth/login')
      .send({ email: 'admin@ona.org', password: 'wrongpassword' })
      .expect(401);
  });

  it('creates a clinic (admin)', async () => {
    const res = await http
      .post('/api/clinics')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 1001, name: 'Kinshasa Eye Clinic', province: 'Kinshasa' })
      .expect(201);
    expect(res.body.data.code).toBe(1001);
    clinicId = res.body.data._id;
  });

  it('creates a patient', async () => {
    const res = await http
      .post('/api/patients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reference: 'PT-2026-0001', age: 54, sex: 'female', clinic: clinicId })
      .expect(201);
    expect(res.body.data.reference).toBe('PT-2026-0001');
    patientId = res.body.data._id;
  });

  it('rejects an invalid patient payload (validation)', async () => {
    await http
      .post('/api/patients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reference: 'PT-X', age: 999, clinic: clinicId })
      .expect(400);
  });

  it('records a screening (blockchain disabled)', async () => {
    const res = await http
      .post('/api/screenings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        patient: patientId,
        clinic: clinicId,
        ai: { prediction: 'cataract_suspected', riskLevel: 'high', confidence: 0.93 },
        isReferral: true,
      })
      .expect(201);
    expect(res.body.data.blockchain.status).toBe('disabled');
  });

  it('is idempotent on offline sync (clientRecordId)', async () => {
    const payload = {
      screenings: [
        {
          patient: patientId,
          clinic: clinicId,
          ai: { prediction: 'normal', riskLevel: 'low', confidence: 0.8 },
          sync: { source: 'offline', clientRecordId: 'device-1-rec-1' },
        },
      ],
    };
    const first = await http
      .post('/api/screenings/sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201);
    expect(first.body.data.created).toBe(1);

    const second = await http
      .post('/api/screenings/sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201);
    expect(second.body.data.created).toBe(0);
    expect(second.body.data.duplicates).toBe(1);
  });

  it('exposes admin statistics', async () => {
    const res = await http
      .get('/api/statistics/overview')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.data.totalScreenings).toBeGreaterThanOrEqual(2);
    expect(res.body.data.riskDistribution.high).toBeGreaterThanOrEqual(1);
  });

  it('records audited requests', async () => {
    const res = await http
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.data.total).toBeGreaterThan(0);
  });
});
