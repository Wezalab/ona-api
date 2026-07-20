import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { GridFSBucket, GridFSFile, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { createHash } from 'crypto';

export interface StoredFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  checksum: string;
}

/**
 * Storage abstraction backed by GridFS (no extra infra). Swap this provider for
 * an S3-backed implementation without touching callers.
 */
@Injectable()
export class StorageService {
  private readonly bucketName = 'uploads';

  constructor(@InjectConnection() private readonly connection: Connection) {}

  private bucket(): GridFSBucket {
    return new GridFSBucket(this.connection.db as any, { bucketName: this.bucketName });
  }

  async save(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    metadata: Record<string, unknown> = {},
  ): Promise<StoredFile> {
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const bucket = this.bucket();

    const id = await new Promise<ObjectId>((resolve, reject) => {
      const stream = bucket.openUploadStream(filename, {
        contentType: mimeType,
        metadata: { ...metadata, checksum },
      });
      Readable.from(buffer)
        .pipe(stream)
        .on('error', reject)
        .on('finish', () => resolve(stream.id as ObjectId));
    });

    return { id: id.toString(), filename, mimeType, size: buffer.length, checksum };
  }

  async getMetadata(id: string): Promise<GridFSFile> {
    const files = await this.bucket()
      .find({ _id: new ObjectId(id) })
      .toArray();
    if (files.length === 0) throw new NotFoundException('File not found');
    return files[0];
  }

  openDownloadStream(id: string): Readable {
    return this.bucket().openDownloadStream(new ObjectId(id));
  }

  async delete(id: string): Promise<void> {
    await this.bucket().delete(new ObjectId(id));
  }
}
