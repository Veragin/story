import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TServerContext } from './serverContext';
import { storyContextOf } from './requestStoryContext';

export const StoryCtx = createParamDecorator(
    (_data: unknown, context: ExecutionContext): TServerContext =>
        storyContextOf(context.switchToHttp().getRequest<object>())
);
