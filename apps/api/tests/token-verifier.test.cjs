const assert = require('node:assert/strict');

const {
  TokenVerifierService,
} = require('../dist/security/token-verifier.service');

async function main() {
  const keys = [
    'OIDC_ISSUER',
    'OIDC_AUDIENCE',
    'OIDC_JWKS_URI',
  ];

  const saved = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );

  try {
    for (const key of keys) {
      delete process.env[key];
    }

    const unconfigured = new TokenVerifierService();

    await assert.rejects(
      unconfigured.verify('invalid-token'),
      (error) => error?.getStatus?.() === 503,
    );

    console.log('OIDC_FAIL_CLOSED_OK');

    process.env.OIDC_ISSUER =
      'https://issuer.example.invalid';
    process.env.OIDC_AUDIENCE = 'sisaf-api';
    process.env.OIDC_JWKS_URI =
      'https://issuer.example.invalid/jwks';

    const verifier = new TokenVerifierService();

    await assert.rejects(
      verifier.verify(''),
      (error) => error?.getStatus?.() === 401,
    );

    console.log('JWT_EMPTY_REJECTED_OK');

    await assert.rejects(
      verifier.verify('not-a-valid-jwt'),
      (error) => error?.getStatus?.() === 401,
    );

    console.log('JWT_MALFORMED_REJECTED_OK');

    console.log('TOKEN_VERIFIER_BASIC_TESTS_OK');
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
