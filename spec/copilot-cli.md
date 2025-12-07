# Automating the Github Copilot Agent from the command line with Copilot CLI

```bash
copilot -p 'A prompt here' --allow-all-tools --deny-tool 'shell(cd)' --deny-tool 'shell(git)' --deny-tool 'shell(pwd)' --deny-tool 'fetch' --deny-tool 'extensions' --deny-tool 'websearch' --deny-tool 'githubRepo'"
```

## Ref:
https://www.r-bloggers.com/2025/10/automating-the-github-copilot-agent-from-the-command-line-with-copilot-cli/
