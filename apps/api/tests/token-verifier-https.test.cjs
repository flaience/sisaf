const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createServer } = require('node:https');

async function main() {
  const {
    generateKeyPair,
    exportJWK,
    SignJWT,
  } = await import('jose');

  const { TokenVerifierService } = require(
    '../dist/security/token-verifier.service'
  );

  const issuer = 'https://issuer.example.invalid';
  const audience = 'sisaf-api';

  const trusted = await generateKeyPair('RS256');
  const untrusted = await generateKeyPair('RS256');

  const jwk = await exportJWK(trusted.publicKey);
  jwk.kid = 'sisaf-test-key';
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  const server = createServer({
    key: readFileSync('/certs/server.key'),
    cert: readFileSync('/certs/server.crt'),
  }, (req, res) => {
    if (req.url !== '/jwks') {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200, {
      'content-type': 'application/json',
    });
    res.end(JSON.stringify({ keys: [jwk] }));
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const port = server.address().port;

    process.env.OIDC_ISSUER = issuer;
    process.env.OIDC_AUDIENCE = audience;
    process.env.OIDC_JWKS_URI =
      `https://127.0.0.1:${port}/jwks`;

    const verifier = new TokenVerifierService();

    const sign = (key) =>
      new SignJWT({})
        .setProtectedHeader({
          alg: 'RS256',
          kid: 'sisaf-test-key',
        })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject('test-user')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(key);

    const validToken = await sign(trusted.privateKey);

    const payload = await verifier.verify(validToken);

    assert.equal(payload.sub, 'test-user');
    console.log('HTTPS_JWKS_VALID_TOKEN_OK');

    const invalidToken = await sign(untrusted.privateKey);

    await assert.rejects(
      verifier.verify(invalidToken),
      (error) => error?.getStatus?.() === 401,
    );

    console.log('HTTPS_JWKS_INVALID_SIGNATURE_OK');
    console.log('TOKEN_VERIFIER_HTTPS_OK');
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) =>
        error ? reject(error) : resolve()
      );
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
