import { styled } from '@mui/material';
import type { TPlayManifestDto } from '@story/protocol';
import { Column, spacingCss } from '@story/ui';
import { useEngine } from '../context';
import { landingImage } from '../images';
import { CharacterList } from './CharacterList';
import { SavedGameActions } from './SavedGameActions';

type Props = {
    manifest: Pick<
        TPlayManifestDto,
        'name' | 'author' | 'description' | 'hasLandingImage'
    >;
};

export const Landing = ({ manifest }: Props) => {
    const e = useEngine();
    const image = manifest.hasLandingImage ? landingImage() : undefined;

    return (
        <SScreen $image={image}>
            <SContent>
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
                    <SSection>
                        <SSectionTitle>
                            {_('Choose a character')}
                        </SSectionTitle>
                        <CharacterList />
                    </SSection>
                )}
            </SContent>
        </SScreen>
    );
};

const SScreen = styled('div')<{ $image: string | undefined }>`
    width: 100vw;
    height: 100vh;
    overflow-y: auto;
    display: flex;
    background: ${({ $image, theme }) =>
        $image
            ? `linear-gradient(to bottom, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.85) 70%), center / cover no-repeat url("${$image}")`
            : `radial-gradient(ellipse at top, #003566, ${theme.palette.background.default} 70%)`};
    background-color: ${({ theme }) => theme.palette.background.default};
`;

const SContent = styled(Column)`
    width: min(960px, 100%);
    margin: auto;
    padding: ${spacingCss(6)} ${spacingCss(2)};
    gap: ${spacingCss(4)};
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
`;

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

const SSection = styled(Column)`
    gap: ${spacingCss(2)};
`;

const SSectionTitle = styled('h2')`
    margin: 0;
    font-size: 22px;
    font-weight: 500;
`;
