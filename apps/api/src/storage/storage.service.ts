import type { Readable } from "node:stream";
import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.schema.js";

export type StoredObject = {
  stream: Readable;
  contentType: string;
  contentLength: number;
  /** В кавычках, как его отдаёт S3, — готовое значение заголовка ETag. */
  etag: string;
};

// Обёртка над S3 из трёх операций, которые нужны каталогу (D26): положить,
// отдать, удалить. Бакет один, поэтому он берётся из конфига, а не передаётся.
@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.bucket = config.S3_BUCKET;
    this.client = new S3Client({
      endpoint: config.S3_ENDPOINT,
      region: config.S3_REGION,
      credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
      // MinIO адресует бакет путём (host/bucket/key), а не поддоменом
      // (bucket.host) — поддомены у localhost не резолвятся.
      forcePathStyle: true,
    });
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
      }),
    );
  }

  /** Отсутствующий объект — не ошибка: удаление должно быть идемпотентным. */
  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  /** `undefined` — объекта нет; прочие ошибки S3 пробрасываются. */
  async get(key: string): Promise<StoredObject | undefined> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        // В Node Body — IncomingMessage (Readable) с примесью SDK-хелперов;
        // тип SDK общий для Node и браузера, поэтому сужаем вручную.
        stream: result.Body as Readable,
        contentType: result.ContentType ?? "application/octet-stream",
        contentLength: result.ContentLength ?? 0,
        etag: result.ETag ?? "",
      };
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }
}

// NoSuchKey — штатный ответ S3; 404 без этого имени бывает у совместимых
// реализаций, поэтому проверяем и код.
function isNotFound(error: unknown): boolean {
  return (
    error instanceof S3ServiceException &&
    (error.name === "NoSuchKey" || error.$metadata.httpStatusCode === 404)
  );
}
