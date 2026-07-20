import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Logger } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../../common/enums/role.enum';
import { AppConfig } from '../../config/configuration';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Seed a first admin from env if the users collection is empty. */
  async onModuleInit(): Promise<void> {
    const seed = this.config.get('seedAdmin', { infer: true });
    if (!seed) return;
    const count = await this.userModel.estimatedDocumentCount();
    if (count > 0) return;
    await this.create({
      email: seed.email,
      password: seed.password,
      fullName: 'ONA Admin',
      role: Role.Admin,
    });
    this.logger.log(`Seeded initial admin: ${seed.email}`);
  }

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const created = await this.userModel.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role ?? Role.HealthWorker,
      clinic: dto.clinic ? new Types.ObjectId(dto.clinic) : undefined,
    });
    return this.sanitize(created);
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<User>> {
    const [items, total] = await Promise.all([
      this.userModel.find().skip(pagination.skip).limit(pagination.limit).sort({ createdAt: -1 }),
      this.userModel.countDocuments(),
    ]);
    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      pages: Math.ceil(total / pagination.limit),
    };
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Includes passwordHash + refreshTokenHash for auth flows. */
  async findByEmailWithSecrets(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash +refreshTokenHash');
  }

  async findByIdWithRefresh(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+refreshTokenHash');
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const update: Record<string, unknown> = { ...dto };
    if (dto.clinic) update.clinic = new Types.ObjectId(dto.clinic);
    const user = await this.userModel.findByIdAndUpdate(id, update, { new: true });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async remove(id: string): Promise<void> {
    const res = await this.userModel.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('User not found');
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { refreshTokenHash: hash ?? undefined });
  }

  private sanitize(user: UserDocument): UserDocument {
    user.set('passwordHash', undefined);
    user.set('refreshTokenHash', undefined);
    return user;
  }
}
