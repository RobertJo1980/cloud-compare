# Working in this repo

Small, embeddable tools that compare what cloud providers charge. Each tool has its own folder (`storage/`, `compute/`) holding a data file, a calculation module, a web component and a demo page. The READMEs describe the layout and how the tools are embedded.

## Rules for the data

- Prices come from the provider's own pricing pages, price lists or documentation, never from third-party aggregators.
- Do not fill in a number from memory. A missing price is acceptable; a wrong one is not.
- When a price changes, update `last_verified` and run the tests.
- Where a provider's own pages disagree, use the newer figure and say so in the provider's `notes`.

## Rules for the code

- No frameworks, no dependencies and no build step. Plain ES modules that run in a browser as they are.
- `calc.js` stays free of DOM access so it can be tested with `node --test`.
- Text shown by a widget follows the writing style below.

## Writing style

These apply to widget text, guides and READMEs.

- No em dashes. Use a comma, a colon, parentheses or a new sentence.
- Plain wording without intensifiers such as "very".
- Professional and direct, with plain headings that name the content.

## Working preferences

Robert's standing preferences. The same section is kept in each of his repos.

- **Tooling goes in containers.** Install runtimes, CLIs and build tools in a dev container, or run them in a throwaway container. Do not install anything on the host OS without asking first.
- **Code lives in GitHub and lasting documents live in iCloud Drive.** Do not leave the only copy of either on the local machine.
- **Ask before creating a GitHub repo.** Do not create repos for work in progress unprompted; raise it once a project has grown large enough to deserve one.
- **Releases.** The blog installs this repo by version tag, so a change reaches the site only after a new tag is pushed and the blog is pointed at it.
