import React from 'react';
import {
    Button,
    Typography,
    Divider,
    Tooltip,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { Agent } from 'code/Visualizer/stores/Agent';
import { TEventId } from 'types/TIds';
import { usePassageForm } from './hooks/usePassageForm';
import { BasicInfoSection } from './components/BasicInfoSection';
import { BodyItemSection } from './components/BodyItemSection';
import { SFormContainer, SHeader, SFormContent, SButtonRow } from './styles';

type Props = {
    onPassageCreated?: (passageId: string) => void;
    onCancel?: () => void;
    agent: Agent;
    eventId: TEventId;
};

export const ScreenPassageCreationForm = ({ onPassageCreated, onCancel, agent, eventId }: Props) => {
    const {
        formData,
        passageId,
        existingPassageIds,
        availablePassageIds,
        isSubmitting,
        isLoadingPassages,
        expandedLinks,
        setPassageId,
        handleInputChange,
        handleBodyItemChange,
        addBodyItem,
        removeBodyItem,
        handleLinkChange,
        handleLinkCostChange,
        addLink,
        removeLink,
        toggleLinkExpanded,
        handleSubmit,
        handleReset,
    } = usePassageForm(eventId, agent);

    return (
        <SFormContainer>
            <SHeader>
                <Tooltip title="Screen passages are interactive screens with choices and links" arrow>
                    <Typography variant="h6" component="h2" sx={{ cursor: 'help' }}>
                        {_('Create New Screen Passage')}
                    </Typography>
                </Tooltip>
            </SHeader>

            <SFormContent>
                <BasicInfoSection
                    passageId={passageId}
                    setPassageId={setPassageId}
                    formData={formData}
                    handleInputChange={handleInputChange}
                    existingPassageIds={existingPassageIds}
                />

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom sx={{ fontSize: '1rem', fontWeight: 500, mb: 1 }}>
                    {_('Passage Content')}
                </Typography>

                {formData.body.map((bodyItem, bodyIndex) => (
                    <BodyItemSection
                        key={bodyIndex}
                        bodyItem={bodyItem}
                        bodyIndex={bodyIndex}
                        bodyCount={formData.body.length}
                        availablePassageIds={availablePassageIds}
                        expandedLinks={expandedLinks}
                        onBodyItemChange={handleBodyItemChange}
                        onRemoveBodyItem={removeBodyItem}
                        onLinkChange={handleLinkChange}
                        onLinkCostChange={handleLinkCostChange}
                        onAddLink={addLink}
                        onRemoveLink={removeLink}
                        onToggleLinkExpanded={toggleLinkExpanded}
                    />
                ))}

                <Button
                    variant="outlined"
                    onClick={addBodyItem}
                    startIcon={<Add fontSize="small" />}
                    size="small"
                    sx={{ mt: 1, fontSize: '0.8rem', py: 0.5 }}
                >
                    {_('Add Content Block')}
                </Button>

                <SButtonRow>
                    <Button
                        variant="outlined"
                        onClick={handleReset}
                        disabled={isSubmitting}
                        size="small"
                        sx={{ fontSize: '0.8rem' }}
                    >
                        {_('Reset')}
                    </Button>
                    {onCancel && (
                        <Button
                            variant="outlined"
                            onClick={onCancel}
                            disabled={isSubmitting}
                            size="small"
                            sx={{ fontSize: '0.8rem' }}
                        >
                            {_('Cancel')}
                        </Button>
                    )}
                    <Button
                        variant="contained"
                        onClick={() => handleSubmit(onPassageCreated)}
                        disabled={isSubmitting || isLoadingPassages}
                        color="primary"
                        size="small"
                        sx={{ fontSize: '0.8rem' }}
                    >
                        {isSubmitting ? _('Creating...') : _('Create Screen Passage')}
                    </Button>
                </SButtonRow>
            </SFormContent>
        </SFormContainer>
    );
};