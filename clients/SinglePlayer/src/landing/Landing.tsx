import { styled } from '@mui/material';
import { useState } from 'react';
import { Column, spacingCss } from '@story/ui';
import { landingImage } from '../images';
import { CharacterSelect } from './CharacterSelect';
import { StoryIntro, type TLandingManifest } from './StoryIntro';

type Props = {
    manifest: TLandingManifest;
};

export const Landing = ({ manifest }: Props) => {
    const [isChoosingCharacter, setIsChoosingCharacter] = useState(false);
    const image = manifest.hasLandingImage ? landingImage() : undefined;

    return (
        <SScreen $image={image}>
            <SContent>
                {isChoosingCharacter ? (
                    <CharacterSelect />
                ) : (
                    <StoryIntro
                        manifest={manifest}
                        onStart={() => setIsChoosingCharacter(true)}
                    />
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
