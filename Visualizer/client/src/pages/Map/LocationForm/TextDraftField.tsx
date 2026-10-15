import { TextField } from '@mui/material';
import type { TTextDraft } from './draft';
import { SourceField } from './SourceField';

type TTextDraftFieldProps = {
    label: string;
    value: TTextDraft;
    onChange: (value: TTextDraft) => void;
    readOnly?: boolean;
    multiline?: boolean;
};

export const TextDraftField = ({
    label,
    value,
    onChange,
    readOnly,
    multiline,
}: TTextDraftFieldProps) => {
    if (value.kind === 'code') {
        return (
            <SourceField
                label={_('%s (code)', label)}
                value={value.code}
                readOnly={readOnly}
                onChange={(code) => onChange({ kind: 'code', code })}
            />
        );
    }
    return (
        <TextField
            label={
                value.kind === 'translated'
                    ? _('%s (translated)', label)
                    : label
            }
            value={value.text}
            onChange={(e) =>
                onChange({ kind: value.kind, text: e.target.value })
            }
            slotProps={{ input: { readOnly } }}
            size="small"
            fullWidth
            multiline={multiline}
            minRows={multiline ? 2 : undefined}
            maxRows={multiline ? 8 : undefined}
        />
    );
};
