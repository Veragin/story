import { Injectable, PayloadTooLargeException, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_STORY_ZIP_BYTES, STORY_IMPORT_ZIP_FIELD } from '@story/protocol';
import type { Observable } from 'rxjs';
import { bodyTooLarge } from '../common/body';

const UPLOAD_LIMITS = { fileSize: MAX_STORY_ZIP_BYTES, files: 1 };

// multer keeps the zip in memory (`@UploadedFile()`), the other form fields land in `@Body()`
@Injectable()
export class StoryZipInterceptor extends FileInterceptor(STORY_IMPORT_ZIP_FIELD, { limits: UPLOAD_LIMITS }) {
    override async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
        try {
            return await super.intercept(context, next);
        } catch (e) {
            if (e instanceof PayloadTooLargeException) throw bodyTooLarge(MAX_STORY_ZIP_BYTES);
            throw e;
        }
    }
}
