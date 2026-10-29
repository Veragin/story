import { TUnkownPassageLinear } from '@story/core';
import { useEngine } from '../context';
import { PassageLayout } from './Components/PassageLayout';
import { PassageLinks } from './Components/PassageLinks';
import { PassageTexts } from './Components/PassageTexts';
import { passageImage } from '../images';

type Props = {
    passage: TUnkownPassageLinear;
};

export const LinearTemplate = ({ passage }: Props) => {
    const e = useEngine();

    return (
        <PassageLayout image={passageImage(passage)}>
            <PassageTexts texts={passage.description.split('\n')} />
            <PassageLinks links={e.processor.getLinks(passage)} />
        </PassageLayout>
    );
};
