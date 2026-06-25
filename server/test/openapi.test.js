const test = require('node:test');
const assert = require('node:assert/strict');
const openapi = require('../src/docs/openapi');

test('OpenAPI document exposes the interactive API surface', () => {
  assert.equal(openapi.openapi, '3.0.3');
  assert.ok(openapi.components.securitySchemes.bearerAuth);
  assert.ok(openapi.paths['/api/auth/login'].post);
  assert.ok(openapi.paths['/api/jobs'].get);
  assert.ok(openapi.paths['/api/applications/jobs/{jobId}/apply'].post);
  assert.equal(
    openapi.paths['/api/applications/jobs/{jobId}/apply']
      .post.requestBody.content['multipart/form-data']
      .schema.properties.resume.format,
    'binary'
  );
});
