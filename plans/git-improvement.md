# Timeline

- see Visualizer, timeline tab, open chapter
- remove the `screen` word from the passage name render
- rename all TPassageTransition to TPassageFinish - it is leaving passage from the chapter
- create new TPassageStart (same type as TPassageLinear) - it will be an entry point to the chapter
- create new TPassageRedirect, used to manage automatic redirects => no image, no text, the body is just array of {condition, redirect: Id}
- remove the redirects from TPassageScreen
- highlight starting passage whit green border, end passage with red, TPassageRedirect purple, the rest will have grey border
- draw connection arrows of the redirects

# Refactor

- modals and dialogs
- all TextFields
- Minimap toggle buton
