@echo off
cd /d "%~dp0"
git rm -r --cached .vscode
git add src/popup/popup.css
git commit -m "Remove .vscode folder and add popup.css - .vscode contains editor-specific settings and should not be tracked - Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push
echo Done! .vscode removed from repository.
pause
