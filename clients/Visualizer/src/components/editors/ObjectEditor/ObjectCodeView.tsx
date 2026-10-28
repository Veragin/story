import type { TFieldDesc } from '@story/protocol';
import { CodeTextArea } from '../../code/CodeTextArea';
import { FieldDiagnostics } from '../../form/FieldDiagnostics';
import { useTypeContext } from '../../../structure/structureContext';
import {
    issueText,
    validateObjectSource,
} from '../../../values/objectValidation';

type TProps = {
    code: string;
    onChange: (code: string) => void;
    fields?: readonly TFieldDesc[];
    allowCustomFields: boolean;
    hasError?: boolean;
    disabled?: boolean;
    ariaLabel: string;
};

export const ObjectCodeView = ({
    code,
    onChange,
    fields,
    allowCustomFields,
    hasError,
    disabled,
    ariaLabel,
}: TProps) => {
    const context = useTypeContext();
    const { parse, issues } = validateObjectSource(code, {
        fields,
        allowCustomFields,
        context,
    });
    const messages = parse.ok ? issues.map(issueText) : [parse.error];
    return (
        <>
            <CodeTextArea
                value={code}
                onChange={onChange}
                minRows={3}
                hasError={hasError || messages.length > 0}
                disabled={disabled}
                ariaLabel={_('%s code', ariaLabel)}
            />
            <FieldDiagnostics messages={messages} />
        </>
    );
};
