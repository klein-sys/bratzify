# Windows Command Execution
When running node scripts (like `npm run dev`, `yarn`, or `npx`) via the `run_command` tool on Windows, always wrap the command in `cmd /c "..."` (e.g., `cmd /c "npm run dev"`) to bypass PowerShell script execution policy restrictions and ensure the command executes successfully.
If the command contains a pipe operator (`|`), you MUST wrap the ENTIRE piped statement in quotes (e.g., `cmd.exe /c "echo token | npx vercel env add TOKEN production"`) so PowerShell doesn't evaluate the right side of the pipe.

# UI vs. Content Theming
When building applications that preview themed content (e.g., video generators, resume builders), strictly decouple the application's UI color theme from the selected content template's theme. Provide independent controls for the website UI to prevent jarring visual changes when the user switches content templates.
