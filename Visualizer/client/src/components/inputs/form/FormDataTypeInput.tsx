import { Button } from '@mui/material';
import {
    objectTypeText,
    type TDataTypeDto,
    type TDiagnosticDto,
} from '@story/visualizer-protocol';
import { CodeTextArea } from '../CodeTextArea';
import {
    rowFields,
    rowRenames,
    structureRows,
} from '../StructureInput/structureRows';
import { FormLabel } from './FormLabel';
import { FormStructureInput } from './FormStructureInput';

type TProps = {
    value: TDataTypeDto | undefined;
    // renames: old key -> new key in this edit, so the caller can move its values
    onChange: (value: TDataTypeDto, renames: Record<string, string>) => void;
    newName: string;
    file: string;
    diagnostics?: TDiagnosticDto[];
    disabled?: boolean;
    dataField?: string;
};

export const FormDataTypeInput = ({
    value,
    onChange,
    newName,
    file,
    diagnostics = [],
    disabled,
    dataField,
}: TProps) => {
    const label = value ? _('data type %s', value.name) : _('data type');

    if (!value) {
        return (
            <FormLabel label={label} diagnostics={diagnostics}>
                <div>
                    <Button
                        size="small"
                        disabled={disabled}
                        onClick={() =>
                            onChange(
                                { name: newName, code: '{}', fields: [] },
                                {}
                            )
                        }
                    >
                        {_('Add a data type')}
                    </Button>
                </div>
            </FormLabel>
        );
    }
    if (!value.fields) {
        // not an object type: only its text can be edited
        return (
            <FormLabel label={label} diagnostics={diagnostics}>
                <CodeTextArea
                    value={value.code}
                    onChange={(code) => onChange({ ...value, code }, {})}
                    hasError={diagnostics.length > 0}
                    disabled={disabled}
                    ariaLabel={label}
                    dataField={dataField}
                />
            </FormLabel>
        );
    }
    return (
        <FormStructureInput
            label={label}
            value={structureRows(value.fields)}
            onChange={(rows = []) => {
                const fields = rowFields(rows);
                // the server writes the text from `fields`; `code` mirrors it for the draft
                onChange(
                    { ...value, fields, code: objectTypeText(fields) },
                    rowRenames(rows)
                );
            }}
            literals={{ file }}
            diagnostics={diagnostics}
            disabled={disabled}
            dataField={dataField}
        />
    );
};
