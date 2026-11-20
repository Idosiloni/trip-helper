# Chat answers for the import parser

`expectations.json` maps each file to the parse result we expect; `src/lib/import/fixtures.test.ts` runs them all.

**Status:** the files here are *synthetic*: written by hand to imitate patterns chats actually produce (a `json` block instead of `tripdata`, comments, trailing commas, smart quotes, unclosed fences, prose after the block, wrapper objects). SPEC §18 asks for **real** answers.
TODO: paste real answers from Claude, ChatGPT and Gemini for prompts 3, 4 and 12 into `real/<model>-<prompt>.md` and add them to `expectations.json`.
