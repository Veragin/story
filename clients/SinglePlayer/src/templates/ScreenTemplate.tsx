import { Header } from '@story/ui';
import { TUnkownPassageScreen } from '@story/core';
import { PassageLayout } from './Components/PassageLayout';
import { PassageLinks } from './Components/PassageLinks';
import { PassageTexts } from './Components/PassageTexts';
import { passageImage } from '../images';

type Props = {
    passage: TUnkownPassageScreen;
};

export const ScreenTemplate = ({ passage }: Props) => {
    const body = passage.body.filter((b) => b.condition !== false);
    const texts = body.flatMap((b) => b.text?.split('\n') ?? []);
    const links = body.flatMap((b) => b.links ?? []);

    return (
        <PassageLayout image={passageImage(passage)} imageName={passage.image}>
            <Header>{passage.title}</Header>
            <PassageTexts texts={texts} />
            <PassageLinks links={links} />
        </PassageLayout>
    );
};
