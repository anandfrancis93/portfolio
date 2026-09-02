// PreToolUse hook on Edit and Write. During a fix task the agent may not weaken the check on
// the code it is fixing: edits to test files are blocked while CLAUDE_TASK_MODE=fix.
// See the playbook's "Give Claude a feedback loop" and plan.md phase A.
import { readFileSync } from 'node:fs';

if (process.env.CLAUDE_TASK_MODE !== 'fix') process.exit(0);

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const filePath = String(input?.tool_input?.file_path ?? '').replace(/\\/g, '/');
const isTestFile = /(^|\/)tests\//.test(filePath) || /\.spec\.[cm]?[jt]s$/.test(filePath);

if (isTestFile) {
  process.stderr.write(
    `Blocked: ${filePath} is a test file and this is a fix task (CLAUDE_TASK_MODE=fix). ` +
      'Fix the code, not the test. If the test itself is wrong, say so and stop; a human ' +
      'changes it in a separate change.\n',
  );
  process.exit(2);
}

process.exit(0);
