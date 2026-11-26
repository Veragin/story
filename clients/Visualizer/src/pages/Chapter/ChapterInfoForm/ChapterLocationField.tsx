import { observer } from 'mobx-react-lite';
import type { TDiagnosticDto, TMaybeCode } from '@story/protocol';
import { FormMaybeCodeAutocompleteInput } from '../../../components/code/FormMaybeCodeAutocompleteInput';
import { useStructureContext } from '../../../structure/structureContext';

type TProps = {
    value: TMaybeCode<string> | undefined;
    onChange: (value: TMaybeCode<string> | undefined) => void;
    diagnostics: readonly TDiagnosticDto[];
    disabled?: boolean;
};

export const ChapterLocationField = observer(
    ({ value, onChange, diagnostics, disabled }: TProps) => (
        <FormMaybeCodeAutocompleteInput
            label={_('Location')}
            value={value}
            onChange={onChange}
            options={useStructureContext().refOptions('Location')}
            diagnostics={diagnostics}
            disabled={disabled}
            dataField="location"
        />
    )
);
