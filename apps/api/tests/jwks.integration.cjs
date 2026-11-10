const assert = require('node:assert/strict');
const { createServer } = require('node:http');

async function main() {
  const {
    generateKeyPair,
    exportJWK,
    SignJWT,
    createRemoteJWKSet,
    jwtVerify,
  } = await import('jose');

  const issuer = 'https://issuer.example.invalid';
  const audience = 'sisaf-api';

  const trusted = await generateKeyPair('RS256');
  const unknown = await generateKeyPair('RS256');

  const trustedJwk = await exportJWK(trusted.publicKey);

  trustedJwk.kid = 'sisaf-test-key-1';
  trustedJwk.alg = 'RS256';
  trustedJwk.use = 'sig';

  const server = createServer((req, res) => {
    if (req.url !== '/jwks') {
      res.writeHead(404);
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      keys: [trustedJwk],
    }));
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    const jwksUrl =
      `http://127.0.0.1:${address.port}/jwks`;

    const jwks = createRemoteJWKSet(new URL(jwksUrl));

    async function sign(privateKey, kid) {
      return new SignJWT({})
        .setProtectedHeader({
          alg: 'RS256',
          kid,
        })
        .setSubject('test-user')
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
    }

    const valid = await sign(
      trusted.privateKey,
      'sisaf-test-key-1',
    );

    const result = await jwtVerify(valid, jwks, {
      issuer,
      audience,
      algorithms: ['RS256'],
    });

    assert.equal(result.payload.sub, 'test-user');

    console.log('JWKS_VALID_TOKEN_OK');

    const invalid = await sign(
      unknown.privateKey,
      'sisaf-test-key-1',
    );

    await assert.rejects(
      jwtVerify(invalid, jwks, {
        issuer,
        audience,
        algorithms: ['RS256'],
      }),
    );

    console.log('JWKS_UNKNOWN_KEY_REJECTED_OK');

    const wrongKid = await sign(
      trusted.privateKey,
      'unknown-key-id',
    );

    await assert.rejects(
      jwtVerify(wrongKid, jwks, {
        issuer,
        audience,
        algorithms: ['RS256'],
      }),
    );

    console.log('JWKS_UNKNOWN_KID_REJECTED_OK');

    console.log('JWKS_INTEGRATION_OK');
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) =>
        error ? reject(error) : resolve(),
      );
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
