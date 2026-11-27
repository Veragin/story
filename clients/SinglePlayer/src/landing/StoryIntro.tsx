import { Button, styled } from '@mui/material';
import type { TPlayManifestDto } from '@story/protocol';
import { Column, spacingCss } from '@story/ui';
import { useEngine } from '../context';
import { SavedGameActions } from './SavedGameActions';

export type TLandingManifest = Pick<
    TPlayManifestDto,
    'name' | 'author' | 'description' | 'hasLandingImage'
>;

type Props = {
    manifest: TLandingManifest;
    onStart: () => void;
};

export const StoryIntro = ({ manifest, onStart }: Props) => {
    const e = useEngine();

    return (
        <>
            <SHeader>
                <STitle>{manifest.name}</STitle>
                {manifest.author && (
                    <SAuthor>{_('by %s', manifest.author)}</SAuthor>
                )}
            </SHeader>
            {manifest.description && (
                <SDescription>{manifest.description}</SDescription>
            )}
            {e.hasSave() ? (
                <SavedGameActions />
            ) : (
                <SStartButton
                    variant="contained"
                    color="secondary"
                    size="large"
                    onClick={onStart}
                >
                    {_('Start')}
                </SStartButton>
            )}
        </>
    );
};

const SHeader = styled(Column)`
    gap: ${spacingCss(1)};
`;

const STitle = styled('h1')`
    margin: 0;
    font-size: clamp(36px, 7vw, 64px);
    font-weight: 600;
    line-height: 1.1;
    color: #ffc300;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
`;

const SAuthor = styled('span')`
    font-size: 18px;
    color: rgba(255, 255, 255, 0.8);
`;

const SDescription = styled('p')`
    margin: 0;
    max-height: 30vh;
    overflow-y: auto;
    font-size: 18px;
    line-height: 1.6;
    white-space: pre-line;
    color: rgba(255, 255, 255, 0.9);
`;

const SStartButton = styled(Button)`
    align-self: flex-start;
    min-width: 160px;
`;
