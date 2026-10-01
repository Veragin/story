import type { TLinkDto } from '@story/visualizer-protocol';
import { IdCodeField, NumberCodeField } from '../../../../components/CodeField';
import { FunctionInput } from '../../../../components/FunctionInput';
import { PlainTextField } from '../../../../components/PlainTextField';
import { CostField } from '../CostField';
import { ItemDiagnostics } from './ItemDiagnostics';
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
            <ItemDiagnostics diagnostics={diag(path)} />
            <PlainTextField
                label={_('Text')}
                value={link.text}
                onChange={(v) => set('text', v)}
                diagnostics={diag(`${path}.text`)}
            />
            <IdCodeField
                label={_('Target passage')}
                value={link.passageId}
                onChange={(v) => set('passageId', v ?? '')}
                options={passageOptions}
                diagnostics={diag(`${path}.passageId`)}
            />
            <NumberCodeField
                label={_('Auto priority')}
                value={link.autoPriortiy}
                onChange={(v) => set('autoPriortiy', v)}
                optional
                diagnostics={diag(`${path}.autoPriortiy`)}
            />
            <CostField
                value={link.cost}
                onChange={(v) => set('cost', v)}
                items={itemOptions}
                diag={diag}
                path={`${path}.cost`}
            />
            <FunctionInput
                label="onFinish"
                value={link.onFinish}
                onChange={(v) => set('onFinish', v)}
                optional
                emptyCode="() => {}"
                placeholder={_('What happens when the link is followed')}
                diagnostics={diag(`${path}.onFinish`)}
            />
        </>
    );
};
