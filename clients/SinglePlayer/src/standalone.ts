// set by `vite.standalone.config.ts`: the web export runs on a static host, with no API behind it
export const IS_STANDALONE = import.meta.env.VITE_STANDALONE === '1';

export const standaloneProblem = (): string =>
    window.location.protocol === 'file:'
        ? _(
              'Open this game through a web server (http or https): browsers do not let a page load its files from file://.'
          )
        : _('play.json is missing next to index.html: upload the whole unzipped folder.');
