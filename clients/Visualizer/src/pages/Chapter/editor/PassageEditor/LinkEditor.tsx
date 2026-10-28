import type { TLinkDto } from '@story/protocol';
import { FormFunctionEditor } from '../../../../components/editors/FormFunctionEditor';
import { FormMaybeCodeNumberInput } from '../../../../components/code/FormMaybeCodeNumberInput';
import { FormMaybeCodeTextInput } from '../../../../components/code/FormMaybeCodeTextInput';
import { FormMaybeCodeAutocompleteInput } from '../../../../components/code/FormMaybeCodeAutocompleteInput';
import { nestedDiagnostics } from '../../../../components/inputs/inputTypes';
import { CostField } from '../CostField/CostField';
import { DiagnosticsList } from '../../../../components/feedback/DiagnosticsList';
import { setField } from './listUtils';
import type { TDiag, TOptionsProps } from './types';

type TProps = TOptionsProps & {
    link: TLinkDto;
    path: string;
    onChange: (link: TLinkDto) => void;
    diag: TDiag;
};

export const LinkEditor = ({
    link,
    path,
    onChange,
    diag,
    passageOptions,
    itemOptions,
}: TProps) => {
    const set = <K extends keyof TLinkDto>(
        key: K,
        value: TLinkDto[K] | undefined
    ) => onChange(setField(link, key, value));
    return (
        <>
            <DiagnosticsList diagnostics={diag(path)} />
            <FormMaybeCodeTextInput
                label={_('Text')}
                value={link.text}
                onChange={(v) => set('text', v ?? '')}
                diagnostics={diag(`${path}.text`)}
                dataField={`${path}.text`}
            />
            <FormMaybeCodeAutocompleteInput
                label={_('Target passage')}
                value={link.passageId}
                onChange={(v) => set('passageId', v ?? '')}
                options={passageOptions}
                diagnostics={diag(`${path}.passageId`)}
                dataField={`${path}.passageId`}
            />
            <FormMaybeCodeNumberInput
                label={_('Auto priority')}
                value={link.autoPriortiy}
                onChange={(v) => set('autoPriortiy', v)}
                optional
                diagnostics={diag(`${path}.autoPriortiy`)}
                dataField={`${path}.autoPriortiy`}
            />
            <CostField
                label={_('Cost')}
                value={link.cost}
                onChange={(v) => set('cost', v)}
                optional
                items={itemOptions}
                diagnostics={diag(`${path}.cost`)}
                diagnosticsOf={nestedDiagnostics(diag, `${path}.cost`)}
                dataField={`${path}.cost`}
            />
            <FormFunctionEditor
                label={_('On finish')}
                value={link.onFinish}
                onChange={(v) => set('onFinish', v)}
                optional
                emptyCode="() => {}"
                placeholder={_('What happens when the link is followed')}
                diagnostics={diag(`${path}.onFinish`)}
                dataField={`${path}.onFinish`}
            />
        </>
    );
};
