import { isCode, type TMaybeCode } from '@story/protocol';
import { imageLinkPath } from '@story/shared';

export const generateBlockReason = (
    description: TMaybeCode<string> | undefined,
    linkFrom: string | undefined
): string | null => {
    if (isCode(description)) return _('Convert the description to text first.');
    if (description === undefined || description.trim() === '') return _('Write a description of the picture first.');
    if (linkFrom !== undefined && imageLinkPath(description) !== undefined) {
        return _('This passage shows a linked image. Replace the link with a description to generate one.');
    }
    return null;
};
