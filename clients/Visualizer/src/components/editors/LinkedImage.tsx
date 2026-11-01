import { Typography } from '@mui/material';
import type { TStoryImageFile } from '../../api';
import { LoadingState } from '../feedback/LoadingState';
import { HintText } from '../feedback/HintText';
import { SImagePreview } from './imagePreview';

type TProps = {
    files: readonly TStoryImageFile[] | null;
    // undefined when the link leaves the story folder
    target: string | undefined;
    link: string;
};

export const LinkedImage = ({ files, target, link }: TProps) => {
    if (files === null) return <LoadingState />;
    if (link === '')
        return <HintText>{_('Type the path of the image to link')}</HintText>;
    const linked = files.find(({ file }) => file === target);
    if (!linked) {
        return (
            <Typography
                variant="caption"
                color="error"
                data-linked-image="missing"
            >
                {_('No story image at %s', link)}
            </Typography>
        );
    }
    return (
        <>
            <SImagePreview
                src={linked.url}
                alt=""
                title={linked.file}
                data-linked-image={linked.file}
            />
            <HintText>{_('Linked image: %s', linked.file)}</HintText>
        </>
    );
};
