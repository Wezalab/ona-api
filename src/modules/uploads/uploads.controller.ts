import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { StorageService } from './storage.service';
import { AppConfig } from '../../config/configuration';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/** Minimal shape of a Multer in-memory file (avoids a hard @types/multer dep). */
interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file?: UploadedFileLike) {
    if (!file) throw new BadRequestException('No file provided (field name: file)');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported type. Allowed: ${ALLOWED_MIME.join(', ')}`);
    }
    const max = this.config.get('uploads.maxBytes', { infer: true });
    if (file.size > max) throw new BadRequestException(`File exceeds ${max} bytes`);

    return this.storage.save(file.buffer, file.originalname, file.mimetype);
  }

  @Get(':id')
  async download(@Param('id') id: string, @Res() res: Response) {
    const meta = await this.storage.getMetadata(id);
    res.setHeader('Content-Type', meta.contentType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${meta.filename}"`);
    this.storage.openDownloadStream(id).pipe(res);
  }
}
