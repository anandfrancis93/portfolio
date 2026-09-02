// PreToolUse hook on Bash. Production deploys need a named release authorization.
// Exit 2 blocks the command and sends the message to Claude. See plan.md phase A and the
// playbook's "Hooks as approval gates".
import { readFileSync } from 'node:fs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const command = String(input?.tool_input?.command ?? '');

const isProductionDeploy =
  (/\bwrangler\b[^\n|&;]*\b(deploy|versions\s+deploy)\b/.test(command) &&
    !/--env[= ]preview\b/.test(command)) ||
  /\bdeploy:production\b/.test(command);

if (isProductionDeploy && !process.env.RELEASE_APPROVAL) {
  process.stderr.write(
    'Production deploys need a release authorization. Set RELEASE_APPROVAL to the approval ' +
      'reference (for example the release ticket or the approving message) before deploying. ' +
      'Preview deploys (--env preview) are always allowed.\n',
  );
  process.exit(2);
}

process.exit(0);
