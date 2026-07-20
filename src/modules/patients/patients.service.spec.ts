import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PatientsService } from './patients.service';
import { Role } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/decorators/current-user.decorator';

const clinicA = new Types.ObjectId().toString();
const clinicB = new Types.ObjectId().toString();

const healthWorker = (clinicId: string): AuthUser => ({
  userId: new Types.ObjectId().toString(),
  email: 'hw@ona.org',
  role: Role.HealthWorker,
  clinicId,
});

const admin: AuthUser = {
  userId: new Types.ObjectId().toString(),
  email: 'admin@ona.org',
  role: Role.Admin,
};

describe('PatientsService (access control)', () => {
  let model: any;
  let service: PatientsService;

  beforeEach(() => {
    model = {
      create: jest.fn(async (doc) => ({ id: 'p1', ...doc })),
      findById: jest.fn(),
    };
    service = new PatientsService(model);
  });

  it('lets a health worker create a patient in their own clinic', async () => {
    await expect(
      service.create({ reference: 'PT-1', clinic: clinicA }, healthWorker(clinicA)),
    ).resolves.toBeDefined();
    expect(model.create).toHaveBeenCalled();
  });

  it('forbids a health worker from creating in another clinic', async () => {
    await expect(
      service.create({ reference: 'PT-1', clinic: clinicB }, healthWorker(clinicA)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('allows an admin to create in any clinic', async () => {
    await expect(
      service.create({ reference: 'PT-1', clinic: clinicB }, admin),
    ).resolves.toBeDefined();
  });

  it('throws NotFound for a missing patient', async () => {
    model.findById.mockResolvedValue(null);
    await expect(service.findById('missing', admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids reading a patient from another clinic', async () => {
    model.findById.mockResolvedValue({ id: 'p1', clinic: { toString: () => clinicB } });
    await expect(service.findById('p1', healthWorker(clinicA))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
