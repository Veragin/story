import { Controller } from '@nestjs/common';
import type { TRouteResponse } from '@story/protocol';
import { ProtocolRoute } from '../../common/ProtocolRoute';
import { readProject } from '../../project/readers/project';
import type { TServerContext } from '../../storyContext/serverContext';
import { StoryCtx } from '../../storyContext/StoryCtx';

@Controller()
export class ProjectInfoController {
    @ProtocolRoute('getProject')
    getProject(@StoryCtx() { sp }: TServerContext): Promise<TRouteResponse<'getProject'>> {
        return sp.run(() => readProject(sp));
    }
}
