import {
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';

export async function validateJwt(
  token: string,
  keyResolver: JWTVerifyGetKey,
  issuer: string,
  audience: string,
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(
    token,
    keyResolver,
    {
      issuer,
      audience,
      algorithms: ['RS256'],
      requiredClaims: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
      ],
    },
  );

  if (
    typeof payload.sub !== 'string' ||
    payload.sub.length === 0
  ) {
    throw new Error('Token sem identidade');
  }

  return payload;
}
