import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'worker@ona.health' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Amina Doe' })
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ enum: Role, default: Role.HealthWorker })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Clinic ObjectId the worker belongs to' })
  @IsOptional()
  @IsMongoId()
  clinic?: string;
}
