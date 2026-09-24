Story lookups shared by the Visualizer's forms.

These six classes read `@story/data`'s register and evaluate passages against a world state, and
none of them has ever had anything to do with a canvas. They lived under
`GUIComponents/Graphs/ChapterPassagesGraph/store/` because that is where the passage graph that
first needed them was; they moved here in VISUALIZER_PLAN Phase 8, when the graph and the
`GUIComponents/` tree around them were deleted.
