import styled from '@emotion/styled';
import { isCode, type TLocationDto, type TValue } from '@story/protocol';
import { spacingCss } from '@story/ui';
import { codeToText } from '../../components/inputs/codeLiterals';
import {
    isArrayOf,
    isTextRecord,
    valueToSource,
} from '../../components/inputs/valueSource';

type TRow = { label: string; text: string };

const isLocalCharacters = isArrayOf(isTextRecord(['name', 'description']));

const valueText = (value: TValue): string => {
    if (typeof value === 'string') return value;
    if (isCode(value)) return codeToText(value.code);
    if (isLocalCharacters(value)) {
        return value
            .map(({ name, description }) =>
                [valueText(name), valueText(description)]
                    .filter(Boolean)
                    .join(' — ')
            )
            .join('\n');
    }
    return valueToSource(value);
};

const locationRows = (
    location: TLocationDto,
    sublocationNames: string[]
): TRow[] => {
    const rows: TRow[] = [
        { label: _('Id'), text: location.id },
        { label: _('Description'), text: valueText(location.description) },
        {
            label: _('Local characters'),
            text: valueText(location.localCharacters),
        },
        { label: _('Sublocations'), text: sublocationNames.join(', ') },
        ...Object.entries(location.userFields ?? {}).map(([key, value]) => ({
            label: key,
            text: valueText(value),
        })),
        { label: _('Initial state'), text: valueText(location.init) },
        { label: _('File'), text: location.file },
    ];
    return rows.filter((row) => row.text !== '' && row.text !== '{}');
};

export const LocationDetails = ({
    location,
    sublocationNames,
}: {
    location: TLocationDto;
    sublocationNames: string[];
}) => (
    <SList>
        {locationRows(location, sublocationNames).map(({ label, text }) => (
            <div key={label}>
                <SLabel>{label}</SLabel>
                <SText>{text}</SText>
            </div>
        ))}
    </SList>
);

const SList = styled.dl`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1.5)};
    margin: 0;
`;

const SLabel = styled.dt`
    font-size: 12px;
    color: #9e9e9e;
    text-transform: uppercase;
    letter-spacing: 0.04em;
`;

const SText = styled.dd`
    margin: ${spacingCss(0.25)} 0 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: #eee;
`;
