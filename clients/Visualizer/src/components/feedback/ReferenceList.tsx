import type { TReferenceDto } from '@story/protocol';
import { styled } from '@mui/material';
import { BulletList } from './BulletList';

type TProps = {
    references: readonly TReferenceDto[];
};

export const ReferenceList = ({ references }: TProps) => (
    <BulletList data-references>
        {references.map((ref, i) => (
            <li key={i}>
                <code>
                    {ref.file}:{ref.line}
                </code>
                {ref.passageId && <> — {ref.passageId}</>}
                {ref.text && <SLineText>{ref.text}</SLineText>}
            </li>
        ))}
    </BulletList>
);

const SLineText = styled('div')`
    font-family: monospace;
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
    color: ${({ theme }) => theme.palette.text.secondary};
`;
