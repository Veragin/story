import { Button, styled, Typography } from '@mui/material';
import { spacingCss } from '@story/ui';
import {
    objectTypeText,
    type TDataTypeDto,
    type TDiagnosticDto,
} from '@story/visualizer-protocol';
import { CodeTextArea } from '../CodeTextArea';
import { InputDiagnostics } from '../InputDiagnostics';
import { StructureInput } from '../StructureInput/StructureInput';
import {
    rowFields,
    rowRenames,
    structureRows,
} from '../StructureInput/structureRows';

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
    const title = value?.name ?? _('Data type');
    const hasError = diagnostics.length > 0;

    const renderBody = () => {
        if (!value) {
            return (
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
            );
        }
        if (!value.fields) {
            // not an object type: only its text can be edited
            return (
                <CodeTextArea
                    value={value.code}
                    onChange={(code) => onChange({ ...value, code }, {})}
                    hasError={hasError}
                    disabled={disabled}
                    ariaLabel={title}
                    dataField={dataField}
                />
            );
        }
        return (
            <StructureInput
                value={structureRows(value.fields)}
                onChange={(rows) => {
                    const fields = rowFields(rows);
                    // the server writes the text from `fields`; `code` mirrors it for the draft
                    onChange(
                        { ...value, fields, code: objectTypeText(fields) },
                        rowRenames(rows)
                    );
                }}
                literals={{ file }}
                hasError={hasError}
                disabled={disabled}
                ariaLabel={title}
                dataField={dataField}
            />
        );
    };

    return (
        <SSection data-form-section="dataType">
            <SHeader>
                <Typography variant="overline" color="text.secondary">
                    {_('Data type')}
                </Typography>
                {value && (
                    <Typography
                        variant="subtitle1"
                        color={hasError ? 'error' : 'text.primary'}
                    >
                        {value.name}
                    </Typography>
                )}
            </SHeader>
            {renderBody()}
            <InputDiagnostics diagnostics={diagnostics} />
        </SSection>
    );
};

const SSection = styled('section')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1)};
    margin-top: ${spacingCss(1)};
    padding: ${spacingCss(1.5)};
    border: 1px solid ${({ theme }) => theme.palette.divider};
    border-radius: ${({ theme }) => theme.shape.borderRadius}px;
    background: ${({ theme }) => theme.palette.background.default};
    min-width: 0;
`;

const SHeader = styled('header')`
    display: flex;
    flex-direction: column;
    padding-bottom: ${spacingCss(1)};
    border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
`;
