import type { TPassageId } from '@story/shared';
import type { TLink } from '@story/types';
import { PassageColumn } from './PassageColumn';
import { PassageLink } from './PassageLink';

type Props = {
    links: TLink<TPassageId>[];
};

export const PassageLinks = ({ links }: Props) => (
    <PassageColumn>
        {links.map((link, i) => (
            <PassageLink key={i} link={link} />
        ))}
    </PassageColumn>
);
