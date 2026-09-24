import { TChapterId, TChapterPassageType, TLocationId } from '@story/types';
import {
    ChapterUpdateRequest,
    PassageUpdateRequest,
    SetTimeRequest,
    TChapterData,
    TPassageData,
    TScreenPassageData,
} from './nodeServerTypes';

export class TypeConverters {
    // Chapter converters
    static chapterDataToUpdateRequest(chapterData: TChapterData): ChapterUpdateRequest {
        const originTime = { start: '2.2. 12:00', end: '2.2. 14:00' };

        if (chapterData.timeRange.start === '') chapterData.timeRange.start = originTime.start;
        if (chapterData.timeRange.end === '') chapterData.timeRange.end = originTime.end;

        const result = {
            title: chapterData.title,
            description: chapterData.description,
            location: chapterData.location,
            timeRange: {
                start: chapterData.timeRange.start,
                end: chapterData.timeRange.end,
            },
            children: chapterData.children,
        };

        console.log('TypeConverter - converting chapterData to updateRequest:', { chapterData, result });
        return result;
    }

    static updateRequestToChapterData(
        updateRequest: ChapterUpdateRequest,
        fallbackLocation: TLocationId
    ): TChapterData {
        return {
            title: updateRequest.title || '',
            description: updateRequest.description || '',
            location: (updateRequest.location as TLocationId) || fallbackLocation,
            timeRange: {
                start: updateRequest.timeRange?.start || '',
                end: updateRequest.timeRange?.end || '',
            },
            children: updateRequest.children || [],
        };
    }

    static passageDataToUpdateRequest(passageData: TPassageData): PassageUpdateRequest {
        return {
            type: passageData.type,
            title: passageData.title,
        };
    }

    static screenPassageDataToUpdateRequest(screenPassageData: TScreenPassageData): PassageUpdateRequest {
        return {
            type: screenPassageData.type,
            chapterId: screenPassageData.chapterId as TChapterId,
            characterId: screenPassageData.characterId,
            id: screenPassageData.id,
            title: screenPassageData.title,
            image: screenPassageData.image,
            body: screenPassageData.body.map((bodyItem) => ({
                text: bodyItem.text,
                redirect: bodyItem.redirect,
                links: bodyItem.links?.map((link) => ({
                    text: link.text,
                    passageId: link.passageId,
                    autoPriority: link.autoPriority,
                    cost: link.cost,
                })),
            })),
        };
    }

    static updateRequestToPassageData(updateRequest: PassageUpdateRequest): TPassageData {
        return {
            type: updateRequest.type as TChapterPassageType,
            title: updateRequest.title,
        };
    }

    // Time range converters
    static createSetTimeRequest(timeRange: { start: string; end: string }): SetTimeRequest {
        return {
            timeRange: {
                start: timeRange.start,
                end: timeRange.end,
            },
        };
    }

    static extractTimeRange(setTimeRequest: SetTimeRequest): { start: string; end: string } {
        return {
            start: setTimeRequest.timeRange.start,
            end: setTimeRequest.timeRange.end,
        };
    }
}
