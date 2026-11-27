const COMBINING_MARKS = /\p{M}/gu;
const APOSTROPHES = /['’]/g;
const NON_ALPHANUMERIC = /[^A-Za-z0-9]+/;
const CASE_BOUNDARY = /(?<=[a-z0-9])(?=[A-Z])/;

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

const camelCaseOf = (title: string): string =>
    title
        .normalize('NFD')
        .replace(COMBINING_MARKS, '')
        .replace(APOSTROPHES, '')
        .split(NON_ALPHANUMERIC)
        .flatMap((part) => part.split(CASE_BOUNDARY))
        .filter(Boolean)
        .map((word, i) => (i === 0 ? word.toLowerCase() : capitalize(word.toLowerCase())))
        .join('');

const startsWithLetter = (id: string) => /^[a-z]/.test(id);

export const idFromTitle = (
    title: string,
    fallback: string,
    isTaken: (id: string) => boolean = () => false
): string => {
    const camel = camelCaseOf(title);
    const base = camel === '' ? fallback : startsWithLetter(camel) ? camel : fallback + capitalize(camel);
    let id = base;
    for (let n = 2; isTaken(id); n++) id = `${base}${n}`;
    return id;
};
