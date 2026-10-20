const test = require('node:test');
const assert = require('node:assert/strict');
const { runHiringAgentPipeline } = require('../src/services/hiringAgent');

test('same-deployment Python calls use the private header and deployment URL', async () => {
  const originalFetch = global.fetch;
  const keys = ['HIRING_AGENT_URL', 'VERCEL_URL', 'AGENT_INTERNAL_SECRET', 'VERCEL_AUTOMATION_BYPASS_SECRET'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    delete process.env.HIRING_AGENT_URL;
    process.env.VERCEL_URL = 'test-deployment.vercel.app';
    process.env.AGENT_INTERNAL_SECRET = 'test-internal-secret';
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 'test-bypass';
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://test-deployment.vercel.app/agent/api/pipeline/run');
      assert.equal(options.headers['X-Agent-Secret'], 'test-internal-secret');
      assert.equal(options.headers['x-vercel-protection-bypass'], 'test-bypass');
      assert.equal(JSON.parse(options.body).resumes_raw[0].text, 'Python experience');
      return { ok: true, json: async () => ({ scores: [{ score: 80 }] }) };
    };
    const result = await runHiringAgentPipeline({ job: { title: 'Engineer' }, resumeText: 'Python experience' });
    assert.equal(result.applicationUpdate.matchScore, 80);
  } finally {
    global.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
