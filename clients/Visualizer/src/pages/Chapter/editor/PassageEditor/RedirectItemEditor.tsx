import { styled, Typography } from '@mui/material';
import type { TRedirectItemDto } from '@story/protocol';
import { DeleteButton } from '../../../../components/buttons/DeleteButton';
import { FormFunctionEditor } from '../../../../components/editors/FormFunctionEditor';
import { FormMaybeCodeAutocompleteInput } from '../../../../components/code/FormMaybeCodeAutocompleteInput';
import { DiagnosticsList } from '../../../../components/feedback/DiagnosticsList';
import type { TOption } from '../../../../structure/option';
import { setField } from './listUtils';
import { SItem, SSpacer, STitleRow } from './styles';
import type { TDiag } from './types';

type TProps = {
    item: TRedirectItemDto;
    index: number;
    path: string;
    onChange: (item: TRedirectItemDto) => void;
    onRemove: () => void;
    diag: TDiag;
    passageOptions: TOption[];
};

export const RedirectItemEditor = ({
    item,
    index,
    path,
    onChange,
    onRemove,
    diag,
    passageOptions,
}: TProps) => (
    <SItem variant="outlined">
        <STitleRow>
            <STitle variant="caption">{_('Redirect %d', index + 1)}</STitle>
            <SSpacer />
            <DeleteButton
                iconOnly
                label={_('Remove redirect')}
                onClick={onRemove}
            />
        </STitleRow>
        <DiagnosticsList diagnostics={diag(path)} />
        <FormFunctionEditor
            label={_('Condition')}
            value={item.condition}
            onChange={(v) => onChange(setField(item, 'condition', v))}
            optional
            emptyCode="true"
            placeholder={_('When this redirect is taken')}
            diagnostics={diag(`${path}.condition`)}
            dataField={`${path}.condition`}
        />
        <FormMaybeCodeAutocompleteInput
            label={_('Redirect to')}
            value={item.redirect}
            onChange={(v) =>
                v !== undefined && onChange({ ...item, redirect: v })
            }
            options={passageOptions}
            diagnostics={diag(`${path}.redirect`)}
            dataField={`${path}.redirect`}
        />
    </SItem>
);

const STitle = styled(Typography)`
    font-weight: 600;
`;
