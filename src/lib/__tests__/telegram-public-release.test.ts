/// <reference types="bun" />
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { load } = require('js-yaml');
const workflow = load(readFileSync(new URL('../../../.github/workflows/telegram-public-release.yml', import.meta.url), 'utf8'));

describe('manual Telegram publication', () => {
  it('never publishes automatically on pushes to main or public-release', () => {
    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
    expect(workflow.on.push).toBeUndefined();
  });

  it('requires explicit publication confirmation', () => {
    expect(workflow.on.workflow_dispatch.inputs.confirm_publish).toMatchObject({
      type: 'boolean', required: true, default: false,
    });
    expect(workflow.jobs.release.if).toBe("github.event_name == 'workflow_dispatch' && inputs.confirm_publish == true");
  });

  it('builds main only instead of the dispatch branch', () => {
    expect(workflow.on.workflow_dispatch.inputs.source_branch.options).toEqual(['main']);
    expect(workflow.on.workflow_dispatch.inputs.source_branch.default).toBe('main');
    const checkout = workflow.jobs.release.steps.find((step: { name: string }) => step.name === 'Checkout source');
    expect(checkout?.with.ref).toBe('${{ inputs.source_branch }}');
  });
});