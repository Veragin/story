import { Link, styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { AddButton } from '../../components/buttons/AddButton';
import { SectionTitle } from '../../components/layout/SectionTitle';
import { router, type TStructureSection } from '../../shell';

type TProps = {
    title: string;
    section: TStructureSection;
    names: readonly string[];
    addLabel: string;
    addAction: string;
    onAdd: () => void;
    disabled?: boolean;
};

export const PrivateMemberList = ({
    title,
    section,
    names,
    addLabel,
    addAction,
    onAdd,
    disabled,
}: TProps) => (
    <SSection data-private-section={section}>
        <SHeader>
            <SectionTitle>{title}</SectionTitle>
            <AddButton
                label={addLabel}
                onClick={onAdd}
                disabled={disabled}
                data-action={addAction}
            />
        </SHeader>
        {names.length === 0 ? (
            <SEmpty>{_('None yet.')}</SEmpty>
        ) : (
            <SList>
                {names.map((name) => (
                    <li key={name}>
                        <Link
                            href={router.href({
                                page: 'structure',
                                section,
                                name,
                            })}
                            data-private-member={name}
                        >
                            <code>{name}</code>
                        </Link>
                    </li>
                ))}
            </SList>
        )}
    </SSection>
);

const SSection = styled('section')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
    min-width: 0;
`;

const SHeader = styled('header')`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: ${spacingCss(0.5)};
    border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
`;

const SList = styled('ul')`
    display: flex;
    flex-wrap: wrap;
    gap: ${spacingCss(0.5)} ${spacingCss(2)};
    margin: 0;
    padding: 0;
    list-style: none;
`;

const SEmpty = styled('div')`
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
    color: ${({ theme }) => theme.palette.text.secondary};
`;
