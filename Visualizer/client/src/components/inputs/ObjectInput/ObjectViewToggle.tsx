import { useRef } from 'react';
import { ToggleButton, Tooltip } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import ViewListIcon from '@mui/icons-material/ViewList';
import {
    code,
    isCode,
    type TMaybeCode,
    type TValueRecord,
} from '@story/visualizer-protocol';
import { valueToSource } from '../valueSource';
import { SViewToggle } from '../viewToggle';
import { parseObjectSource, type TObjectParse } from './objectValidation';

type TProps = {
    value: TMaybeCode<TValueRecord>;
    onChange: (value: TMaybeCode<TValueRecord>) => void;
    disabled?: boolean;
    ariaLabel: string;
};

type TView = 'inputs' | 'code';

export const ObjectViewToggle = ({
    value,
    onChange,
    disabled,
    ariaLabel,
}: TProps) => {
    // the round trip keeps the exact values (e.g. key order, `-0`) when the code is unchanged
    const remembered = useRef<{ code: string; record: TValueRecord } | null>(
        null
    );
    const view: TView = isCode(value) ? 'code' : 'inputs';

    const restore = (): TObjectParse | null => {
        if (!isCode(value)) return null;
        if (remembered.current?.code === value.code)
            return { ok: true, value: remembered.current.record };
        return parseObjectSource(value.code);
    };
    const back = restore();

    const select = (next: TView | null) => {
        if (!next || next === view) return;
        if (next === 'inputs') {
            if (back?.ok) onChange(back.value);
            return;
        }
        if (isCode(value)) return;
        const source = valueToSource(value);
        remembered.current = { code: source, record: value };
        onChange(code(source));
    };

    const inputsBlocked = back !== null && !back.ok;

    return (
        <SViewToggle
            size="small"
            exclusive
            value={view}
            disabled={disabled}
            onChange={(_e, next: TView | null) => select(next)}
            aria-label={_('%s view', ariaLabel)}
        >
            <ToggleButton
                value="inputs"
                aria-label={_('Inputs')}
                data-action="show-inputs"
                disabled={disabled || inputsBlocked}
            >
                <Tooltip
                    title={
                        back && !back.ok
                            ? _('Cannot show as inputs: %s', back.error)
                            : _('Inputs')
                    }
                >
                    <ViewListIcon fontSize="small" />
                </Tooltip>
            </ToggleButton>
            <ToggleButton
                value="code"
                aria-label={_('Code')}
                data-action="show-code"
            >
                <Tooltip title={_('Code')}>
                    <CodeIcon fontSize="small" />
                </Tooltip>
            </ToggleButton>
        </SViewToggle>
    );
};
