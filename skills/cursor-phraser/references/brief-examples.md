# Brief examples

The reply the user copies is one brief in the strong shape. This page is the contrast, not a second answer.

## Weak

A weak brief tells the agent which lines to type.

> Fix the blank-password bug. In the sign-in handler, reject empty strings, and add a test that expects no session. Change only that function.

That is a guess. If the cause sits somewhere else, the agent follows the guess anyway.

## Strong

A strong brief states the problem, the outcome, and the edges, then tells the agent to investigate.

```
Goal
Signing in with an empty password is accepted. After this change, a blank or missing password does not create a session, and a correct password still does.

Context
Repo: github.com/northwind/ledger
The user can submit the sign-in form with the password field empty and end up signed in. They did not name a file. Assumption: this is the real sign-in path, not a demo screen.

Constraints
Keep the current session cookie. Do not add another way to sign in. Default, because they named no others: leave unrelated screens alone.

Out of scope
Password reset, signup, rate limits, and copy changes.

Success
A blank password does not create a session. A correct password still signs in. Existing checks for a valid sign-in still pass.

Investigate
Read the repo and choose the edits yourself. Do not follow a line-by-line patch. Non-binding guess: an empty string may be treated as present. Confirm that from the code, or drop it. The guess is not a requirement.
```

Use the strong shape. One brief, not a weak draft beside it.
