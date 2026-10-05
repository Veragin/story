import { IconButton, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import type { TBodyItemDto } from '@story/visualizer-protocol';
import { FormFunctionInput } from '../../../../components/inputs/form/FormFunctionInput';
import { FormStringInput } from '../../../../components/inputs/form/FormStringInput';
import { FormTypeInput } from '../../../../components/inputs/form/FormTypeInput';
import { ItemDiagnostics } from './ItemDiagnostics';
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
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {_('Body item %d', index + 1)}
                </Typography>
                <SSpacer />
                <Tooltip title={_('Remove body item')}>
                    <IconButton
                        size="small"
                        aria-label={_('Remove body item')}
                        onClick={onRemove}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </STitleRow>
            <ItemDiagnostics diagnostics={diag(path)} />
            <FormFunctionInput
                label={_('Condition')}
                value={item.condition}
                onChange={(v) => set('condition', v)}
                optional
                emptyCode="true"
                placeholder={_('When the item is shown')}
                diagnostics={diag(`${path}.condition`)}
                dataField={`${path}.condition`}
            />
            <FormTypeInput
                label={_('Redirect')}
                value={item.redirect}
                onChange={(v) => set('redirect', v)}
                options={passageOptions}
                optional
                diagnostics={diag(`${path}.redirect`)}
                dataField={`${path}.redirect`}
            />
            <FormStringInput
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
