const assert = require('node:assert/strict');

const {
  validateJwt,
} = require('../dist/security/jwt-validator');

async function main() {
  const {
    generateKeyPair,
    SignJWT,
  } = await import('jose');

  const issuer = 'https://issuer.example.invalid';
  const audience = 'sisaf-api';

  const { publicKey, privateKey } =
    await generateKeyPair('RS256');

  const resolveKey = async () => publicKey;

  const makeToken = (options = {}) => {
    const now = Math.floor(Date.now() / 1000);

    return new SignJWT({
      role: 'user',
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('test-user')
      .setIssuer(options.issuer ?? issuer)
      .setAudience(options.audience ?? audience)
      .setIssuedAt(now)
      .setExpirationTime(
        options.expired ? now - 60 : now + 300,
      )
      .sign(privateKey);
  };

  const valid = await makeToken();

  const payload = await validateJwt(
    valid,
    resolveKey,
    issuer,
    audience,
  );

  assert.equal(payload.sub, 'test-user');
  console.log('JWT_VALID_SIGNATURE_OK');

  const parts = valid.split('.');
  const signature = parts[2];

  parts[2] =
    (signature[0] === 'A' ? 'B' : 'A') +
    signature.slice(1);

  await assert.rejects(
    validateJwt(
      parts.join('.'),
      resolveKey,
      issuer,
      audience,
    ),
  );

  console.log('JWT_TAMPERED_REJECTED_OK');

  await assert.rejects(
    validateJwt(
      await makeToken({ expired: true }),
      resolveKey,
      issuer,
      audience,
    ),
  );

  console.log('JWT_EXPIRED_REJECTED_OK');

  await assert.rejects(
    validateJwt(
      await makeToken({
        issuer: 'https://other.example.invalid',
      }),
      resolveKey,
      issuer,
      audience,
    ),
  );

  console.log('JWT_WRONG_ISSUER_REJECTED_OK');

  await assert.rejects(
    validateJwt(
      await makeToken({
        audience: 'another-api',
      }),
      resolveKey,
      issuer,
      audience,
    ),
  );

  console.log('JWT_WRONG_AUDIENCE_REJECTED_OK');

  const wrongAlgorithm = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('test-user')
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(
      'temporary-test-secret-not-for-production',
    ));

  await assert.rejects(
    validateJwt(
      wrongAlgorithm,
      resolveKey,
      issuer,
      audience,
    ),
  );

  console.log('JWT_WRONG_ALGORITHM_REJECTED_OK');
  console.log('JWT_CRYPTO_TESTS_OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
