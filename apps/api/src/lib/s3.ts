import { createHmac, createHash } from "crypto";

// AWS Signature V4 — native fetch, no SDK needed
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function sha256hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
  const kDate = hmac("AWS4" + secretKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function signRequest(params: {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body: Buffer | string;
  accessKey: string;
  secretKey: string;
  region: string;
  service: string;
}): Record<string, string> {
  const { method, url, headers, body, accessKey, secretKey, region, service } = params;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256hex(body);

  const allHeaders: Record<string, string> = {
    ...headers,
    host: url.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };

  const signedHeaderNames = Object.keys(allHeaders).sort();
  const canonicalHeaders = signedHeaderNames.map((k) => `${k}:${allHeaders[k]}`).join("\n") + "\n";
  const signedHeaders = signedHeaderNames.join(";");

  const canonicalUri = url.pathname;
  const canonicalQueryString = url.searchParams.toString();

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256hex(canonicalRequest)].join("\n");

  const signingKey = getSigningKey(secretKey, dateStamp, region, service);
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...allHeaders,
    authorization,
  };
}

export function isS3Configured(): boolean {
  return !!(
    process.env.TIMEWEB_S3_ACCESS_KEY &&
    process.env.TIMEWEB_S3_SECRET_KEY &&
    process.env.TIMEWEB_S3_BUCKET
  );
}

// Upload buffer to S3, returns public URL
export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const endpoint = process.env.TIMEWEB_S3_ENDPOINT ?? "https://s3.timeweb.cloud";
  const region = process.env.TIMEWEB_S3_REGION ?? "ru-1";
  const accessKey = process.env.TIMEWEB_S3_ACCESS_KEY!;
  const secretKey = process.env.TIMEWEB_S3_SECRET_KEY!;
  const bucket = process.env.TIMEWEB_S3_BUCKET!;

  const host = new URL(endpoint).host;
  const url = new URL(`https://${bucket}.${host}/${key}`);

  const headers = signRequest({
    method: "PUT",
    url,
    headers: {
      "content-type": contentType,
      "x-amz-acl": "public-read",
    },
    body: buffer,
    accessKey,
    secretKey,
    region,
    service: "s3",
  });

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers,
    body: buffer as unknown as BodyInit,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`S3 upload failed: ${res.status} ${text}`);
  }

  return url.toString();
}

// Delete object from S3 by key
export async function deleteFromS3(key: string): Promise<void> {
  const endpoint = process.env.TIMEWEB_S3_ENDPOINT ?? "https://s3.timeweb.cloud";
  const region = process.env.TIMEWEB_S3_REGION ?? "ru-1";
  const accessKey = process.env.TIMEWEB_S3_ACCESS_KEY!;
  const secretKey = process.env.TIMEWEB_S3_SECRET_KEY!;
  const bucket = process.env.TIMEWEB_S3_BUCKET!;

  const host = new URL(endpoint).host;
  const url = new URL(`https://${bucket}.${host}/${key}`);

  const headers = signRequest({
    method: "DELETE",
    url,
    headers: {},
    body: "",
    accessKey,
    secretKey,
    region,
    service: "s3",
  });

  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers,
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`S3 delete failed: ${res.status} ${text}`);
  }
}
