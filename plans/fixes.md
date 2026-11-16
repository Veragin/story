# Visualizr UI fixes

- while displaying passage sidebar:
    - on top display basic control incon buttons in order: `delete passage` `code edit` gap(space between) `discard changes` `save changes` `close`
    - Under display passage title (without any label) as heading (user can click on it to edit) no border on the end of the line display passage type badge
    - Under with small text display passage id and file path (no label), if user clicks on it (it will copy the value into clip board)
    - Under display description text area input field (the best would be to have it without border just text that user can click on and edit right away), save the description as a jsdoc comment under the function, the description text area will have placeholder `Write down description here`
    - under display the image picker (as is already implemented) (not for redirect passages)
    - display the execution and body (as is already implemented)
- while editing chapter add the same description TextArea
- these descriptions will be used for ai agent to implement the functionality based on description
- unifiy sidebar design in Visualizer (same control placement, information structure)
    - location sidebar in map tab
    - chapter sidebar in timeline tab
    - passage sidebar in timeline tab
- while creating passage/chapter ... dont ask for id but for Title => generate the id from the title
