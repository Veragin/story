import {
    Button,
    IconButton,
    Paper,
    styled,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
    isCode,
    type TChapterChildDto,
    type TDiagnosticDto,
    type TMaybeCode,
    type TTimeRangeDto,
} from '@story/visualizer-protocol';
import {
    CodeField,
    CodeTextArea,
    FieldDiagnostics,
    IdCodeField,
    StringCodeField,
    type TOption,
} from '../../../components/CodeField';
import { quoteString } from '../../../components/codeLiterals';
import type { TChapterInfoValue } from './chapterInfo';

export type TChapterInfoFormProps = {
    value: TChapterInfoValue;
    onChange: (value: TChapterInfoValue) => void;
    /** Pickers: `/project` locations and chapters. */
    locations: TOption[];
    chapters: TOption[];
    /** 422 diagnostics by field path (`title`, `timeRange.start`, `children.0.condition`). */
    diagnostics?: (path: string) => TDiagnosticDto[];
    disabled?: boolean;
};

const noDiagnostics = () => [];

const timeToCode = (t: string) => `Time.fromString(${quoteString(t)})`;
const TIME_RE = /^Time\.fromString\(\s*(['"])(.*)\1\s*\)$/;
const parseTime = (code: string) => TIME_RE.exec(code.trim())?.[2];

/**
 * Controlled form for a chapter's info (plan WP6 "edit chapter info"): title, description,
 * location, time range and the child chapters with their condition. Every field follows the
 * code-field convention, so a value that is code in the source (`_('Wedding Chapter')`) stays
 * code. Reusable: the chapter view opens it in a modal (`ChapterInfoDialog`), the timeline can
 * embed it for "Add chapter".
 */
export const ChapterInfoForm = ({
    value,
    onChange,
    locations,
    chapters,
    diagnostics = noDiagnostics,
    disabled,
}: TChapterInfoFormProps) => {
    const set = <K extends keyof TChapterInfoValue>(
        key: K,
        v: TChapterInfoValue[K] | undefined
    ) => {
        if (v !== undefined) onChange({ ...value, [key]: v });
    };

    return (
        <SForm>
            <StringCodeField
                label={_('Title')}
                value={value.title}
                onChange={(v) => set('title', v)}
                diagnostics={diagnostics('title')}
                disabled={disabled}
            />
            <StringCodeField
                label={_('Description')}
                multiline
                value={value.description}
                onChange={(v) => set('description', v)}
                diagnostics={diagnostics('description')}
                disabled={disabled}
            />
            <IdCodeField
                label={_('Location')}
                value={value.location}
                onChange={(v) => set('location', v)}
                options={locations}
                diagnostics={diagnostics('location')}
                disabled={disabled}
            />
            <TimeRangeField
                value={value.timeRange}
                onChange={(v) => set('timeRange', v)}
                diagnostics={diagnostics}
                disabled={disabled}
            />
            <ChildrenField
                value={value.children}
                onChange={(v) => set('children', v)}
                chapters={chapters}
                diagnostics={diagnostics}
                disabled={disabled}
            />
        </SForm>
    );
};

const TimeRangeField = ({
    value,
    onChange,
    diagnostics,
    disabled,
}: {
    value: TMaybeCode<TTimeRangeDto>;
    onChange: (v: TMaybeCode<TTimeRangeDto>) => void;
    diagnostics: (path: string) => TDiagnosticDto[];
    disabled?: boolean;
}) => {
    if (isCode(value)) {
        return (
            <div>
                <Typography variant="caption" color="text.secondary">
                    {_('Time range (code)')}
                </Typography>
                <CodeTextArea
                    value={value.code}
                    onChange={(code) => onChange({ code })}
                    disabled={disabled}
                />
                <FieldDiagnostics diagnostics={diagnostics('timeRange')} />
            </div>
        );
    }
    const end = (key: 'start' | 'end', label: string) => (
        <CodeField<string>
            label={label}
            value={value[key]}
            onChange={(v) =>
                v !== undefined && onChange({ ...value, [key]: v })
            }
            emptyLiteral=""
            toCode={timeToCode}
            fromCode={parseTime}
            diagnostics={diagnostics(`timeRange.${key}`)}
            disabled={disabled}
            literal={(t, change, hasError) => (
                <TextField
                    size="small"
                    value={t}
                    error={hasError}
                    placeholder="2.1. 8:00"
                    disabled={disabled}
                    onChange={(e) => change(e.target.value)}
                />
            )}
        />
    );
    return (
        <div>
            <Typography variant="caption" color="text.secondary">
                {_('Time range (day.month. hour:minute)')}
            </Typography>
            <SRow>
                {end('start', _('Start'))}
                {end('end', _('End'))}
            </SRow>
            <FieldDiagnostics diagnostics={diagnostics('timeRange')} />
        </div>
    );
};

const ChildrenField = ({
    value,
    onChange,
    chapters,
    diagnostics,
    disabled,
}: {
    value: TMaybeCode<TChapterChildDto[]>;
    onChange: (v: TMaybeCode<TChapterChildDto[]>) => void;
    chapters: TOption[];
    diagnostics: (path: string) => TDiagnosticDto[];
    disabled?: boolean;
}) => {
    if (isCode(value)) {
        return (
            <div>
                <Typography variant="caption" color="text.secondary">
                    {_('Child chapters (code)')}
                </Typography>
                <CodeTextArea
                    value={value.code}
                    onChange={(code) => onChange({ code })}
                    disabled={disabled}
                />
                <FieldDiagnostics diagnostics={diagnostics('children')} />
            </div>
        );
    }
    const setChild = (i: number, child: TChapterChildDto) =>
        onChange(value.map((c, j) => (j === i ? child : c)));
    return (
        <SChildren>
            <Typography variant="caption" color="text.secondary">
                {_('Child chapters')}
            </Typography>
            <FieldDiagnostics diagnostics={diagnostics('children')} />
            {value.map((child, i) => (
                <SChild key={i} variant="outlined">
                    <SRow>
                        <IdCodeField
                            label={_('Chapter')}
                            value={child.chapterId}
                            onChange={(v) =>
                                v !== undefined &&
                                setChild(i, { ...child, chapterId: v })
                            }
                            options={chapters}
                            diagnostics={diagnostics(`children.${i}.chapterId`)}
                            disabled={disabled}
                        />
                        <Tooltip title={_('Remove child chapter')}>
                            <IconButton
                                size="small"
                                aria-label={_('Remove child chapter')}
                                disabled={disabled}
                                onClick={() =>
                                    onChange(value.filter((_c, j) => j !== i))
                                }
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </SRow>
                    <StringCodeField
                        label={_('Condition')}
                        value={child.condition}
                        onChange={(v) =>
                            v !== undefined &&
                            setChild(i, { ...child, condition: v })
                        }
                        diagnostics={diagnostics(`children.${i}.condition`)}
                        disabled={disabled}
                    />
                </SChild>
            ))}
            <Button
                size="small"
                color="inherit"
                startIcon={<AddIcon fontSize="small" />}
                disabled={disabled}
                sx={{ alignSelf: 'flex-start' }}
                onClick={() =>
                    onChange([
                        ...value,
                        { condition: '', chapterId: chapters[0]?.id ?? '' },
                    ])
                }
            >
                {_('Add child chapter')}
            </Button>
        </SChildren>
    );
};

const SForm = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
`;

const SRow = styled('div')`
    display: flex;
    gap: 12px;
    align-items: flex-start;
`;

const SChildren = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const SChild = styled(Paper)`
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.03);
`;
