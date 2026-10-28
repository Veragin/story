import { styled, Typography } from '@mui/material';
import { DeleteButton } from '../../../../components/buttons/DeleteButton';
import type { TBodyItemDto } from '@story/protocol';
import { FormFunctionEditor } from '../../../../components/editors/FormFunctionEditor';
import { FormMaybeCodeTextInput } from '../../../../components/code/FormMaybeCodeTextInput';
import { FormMaybeCodeAutocompleteInput } from '../../../../components/code/FormMaybeCodeAutocompleteInput';
import { DiagnosticsList } from '../../../../components/feedback/DiagnosticsList';
import { Links } from './Links';
import { setField } from './listUtils';
import { SItem, SSpacer, STitleRow } from './styles';
import type { TDiag, TOptionsProps } from './types';

type TProps = TOptionsProps & {
    item: TBodyItemDto;
    index: number;
    path: string;
    onChange: (item: TBodyItemDto) => void;
    onRemove: () => void;
    diag: TDiag;
};

export const BodyItemEditor = ({
    item,
    index,
    path,
    onChange,
    onRemove,
    diag,
    passageOptions,
    itemOptions,
}: TProps) => {
    const set = <K extends keyof TBodyItemDto>(
        key: K,
        value: TBodyItemDto[K] | undefined
    ) => onChange(setField(item, key, value));
    return (
        <SItem variant="outlined">
            <STitleRow>
                <STitle variant="caption">
                    {_('Body item %d', index + 1)}
                </STitle>
                <SSpacer />
                <DeleteButton
                    iconOnly
                    label={_('Remove body item')}
                    onClick={onRemove}
                />
            </STitleRow>
            <DiagnosticsList diagnostics={diag(path)} />
            <FormFunctionEditor
                label={_('Condition')}
                value={item.condition}
                onChange={(v) => set('condition', v)}
                optional
                emptyCode="true"
                placeholder={_('When the item is shown')}
                diagnostics={diag(`${path}.condition`)}
                dataField={`${path}.condition`}
            />
            <FormMaybeCodeAutocompleteInput
                label={_('Redirect')}
                value={item.redirect}
                onChange={(v) => set('redirect', v)}
                options={passageOptions}
                optional
                diagnostics={diag(`${path}.redirect`)}
                dataField={`${path}.redirect`}
            />
            <FormMaybeCodeTextInput
                label={_('Text')}
                multiline
                value={item.text}
                // an empty text is left out of the source
                onChange={(v) => set('text', v === '' ? undefined : v)}
                diagnostics={diag(`${path}.text`)}
                dataField={`${path}.text`}
            />
            <Links
                value={item.links}
                onChange={(v) => set('links', v)}
                path={`${path}.links`}
                diag={diag}
                passageOptions={passageOptions}
                itemOptions={itemOptions}
            />
        </SItem>
    );
};

const STitle = styled(Typography)`
    font-weight: 600;
`;
