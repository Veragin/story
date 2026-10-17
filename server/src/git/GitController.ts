import { Body, Controller, Query } from '@nestjs/common';
import type { TGitCommitResultDto, TGitDto, TGitLogEntryDto, TGitPullResultDto, TGitStatusDto } from '@story/protocol';
import { ProtocolRoute } from '../common/ProtocolRoute';
import type { TServerContext } from '../storyContext/serverContext';
import { StoryCtx } from '../storyContext/StoryCtx';
import { GitService } from './GitService';

@Controller()
export class GitController {
    constructor(private readonly git: GitService) {}

    @ProtocolRoute('getGit')
    getGit(@StoryCtx() ctx: TServerContext): Promise<TGitDto> {
        return this.git.getGit(ctx);
    }

    @ProtocolRoute('updateGitConfig')
    updateGitConfig(@StoryCtx() ctx: TServerContext, @Body() body: unknown): Promise<TGitDto> {
        return this.git.updateConfig(ctx, body);
    }

    @ProtocolRoute('setupGit')
    setupGit(@StoryCtx() ctx: TServerContext, @Body() body: unknown): Promise<TGitDto> {
        return this.git.setup(ctx, body);
    }

    @ProtocolRoute('deleteGitConfig')
    deleteGitConfig(@StoryCtx() ctx: TServerContext, @Body() body: unknown): Promise<void> {
        return this.git.deleteConfig(ctx, body);
    }

    @ProtocolRoute('gitFetch')
    gitFetch(@StoryCtx() ctx: TServerContext): Promise<TGitStatusDto> {
        return this.git.fetch(ctx);
    }

    @ProtocolRoute('gitCommit')
    gitCommit(@StoryCtx() ctx: TServerContext, @Body() body: unknown): Promise<TGitCommitResultDto> {
        return this.git.commit(ctx, body);
    }

    @ProtocolRoute('gitPush')
    gitPush(@StoryCtx() ctx: TServerContext): Promise<TGitStatusDto> {
        return this.git.push(ctx);
    }

    @ProtocolRoute('gitPull')
    gitPull(@StoryCtx() ctx: TServerContext): Promise<TGitPullResultDto> {
        return this.git.pull(ctx);
    }

    @ProtocolRoute('gitCheckout')
    gitCheckout(@StoryCtx() ctx: TServerContext, @Body() body: unknown): Promise<TGitStatusDto> {
        return this.git.checkout(ctx, body);
    }

    @ProtocolRoute('getGitLog')
    getGitLog(@StoryCtx() ctx: TServerContext, @Query() query: unknown): Promise<TGitLogEntryDto[]> {
        return this.git.log(ctx, query);
    }
}
