import { Text } from '@story/ui';
import { PassageColumn } from './PassageColumn';

type Props = {
    texts: string[];
};

export const PassageTexts = ({ texts }: Props) => (
    <PassageColumn>
        {texts.map((t, i) => (
            <Text key={i}>{t}</Text>
        ))}
    </PassageColumn>
);
