# Style

## Comments

- Say why, or what a reader cannot see from the code; never narrate the code.
- A file starts with a comment only when its purpose is not clear from its name and exports.
- No codenames, no ticket or phase numbers, no author names, no dates.

## Terminal messages

- Results go to standard output; everything else goes to standard error.
- Errors start with `nightwell: `, state what happened in one sentence, then what to do next.
- One wording per situation: reuse the existing message; search before writing a new one.
- Plain words, present tense, no exclamation marks, no blame. A tie is called a tie or a dependency,
  never a problem, issue, violation or risk (R11).
- Colour is decoration only: nothing is conveyed by colour alone.
- Every value read from outside the process is encoded for the terminal before it is printed (R10).

## CLI flags

- One flag name per concept across all commands; search existing flags before adding one.
- Long names in kebab-case; a short form only for the most common flags.
- A flag never takes a secret as its only input path: secrets come from the environment, a file or
  standard input.
- Adding, renaming or removing a flag, or changing an exit code, is an ask-first item.

## Code

- TypeScript, ES modules, erasable syntax only; relative imports carry the `.ts` extension.
- Formatting and lint are mechanical: run `npm run format`, do not argue with the formatter.
- Paths in output are POSIX-style and relative.
